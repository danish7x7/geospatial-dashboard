# data/stage5_compute_zones.py — derive food_desert_zones + healthcare_desert_zones (PostGIS)
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

engine = create_engine(
    f"postgresql+psycopg2://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}"
    f"@{os.environ['PGHOST']}:{os.environ['PGPORT']}/{os.environ['PGDATABASE']}"
)

DESTINATION_CARE = ('hospital', 'clinic', 'dialysis', 'mental_health')

# ---------------------------------------------------------------------------
# FOOD DESERT ZONES — severity from USDA Atlas flags; continuous composite score
# Grocery distance + count populated from food_access_points (mirrors healthcare
# pattern: centroid-to-nearest distance, count of points within tract).
# ---------------------------------------------------------------------------
food_sql = """
TRUNCATE food_desert_zones RESTART IDENTITY;
INSERT INTO food_desert_zones
    (census_tract_id, geom, food_access_score, nearest_grocery_distance_m,
     num_food_access_points, population_affected, severity)
WITH grocery AS (
    -- Filter explicitly to grocery_store: defensive against future loads of
    -- farmers_market / food_pantry / community_garden into the same table.
    SELECT geom::geography AS g
    FROM food_access_points
    WHERE type = 'grocery_store'
),
tract_metrics AS (
    SELECT
        t.census_tract_id,
        t.geom,
        t.population,
        t.is_low_access,
        t.is_low_income,
        t.is_food_desert,
        t.pct_without_vehicle,
        t.pct_snap,
        -- nearest grocery distance from tract centroid (m); NULL if no points
        (SELECT MIN(ST_Distance(ST_Centroid(t.geom)::geography, g.g))
         FROM grocery g) AS grocery_m,
        -- grocery points physically within this tract
        (SELECT COUNT(*) FROM food_access_points f
         WHERE f.type = 'grocery_store'
           AND ST_Within(f.geom, t.geom)) AS n_within
    FROM census_tracts t
    WHERE t.geom IS NOT NULL
)
SELECT
    census_tract_id,
    geom,
    -- Continuous composite (100 = best access). Weighted penalties, clamped 0-100.
    -- Score formula unchanged: USDA Atlas flags + vehicle/SNAP penalties.
    GREATEST(0, LEAST(100,
        100
        - (CASE WHEN is_low_access THEN 40 ELSE 0 END)
        - (CASE WHEN is_low_income THEN 30 ELSE 0 END)
        - (COALESCE(pct_without_vehicle, 0) / 100.0 * 20)
        - (COALESCE(pct_snap, 0) / 100.0 * 10)
    ))::float AS food_access_score,
    grocery_m AS nearest_grocery_distance_m,
    n_within  AS num_food_access_points,
    CASE
        WHEN is_food_desert THEN population
        WHEN is_low_access  THEN population
        ELSE 0
    END AS population_affected,
    CASE
        WHEN is_food_desert THEN 'critical'      -- low-income AND low-access
        WHEN is_low_access  THEN 'high'           -- low-access only
        WHEN is_low_income  THEN 'medium'         -- low-income only
        ELSE 'low'
    END AS severity
FROM tract_metrics;
"""

# ---------------------------------------------------------------------------
# HEALTHCARE DESERT ZONES — distances to nearest destination-care facilities
# ---------------------------------------------------------------------------
health_sql = f"""
TRUNCATE healthcare_desert_zones RESTART IDENTITY;
INSERT INTO healthcare_desert_zones
    (census_tract_id, geom, healthcare_access_score, nearest_hospital_distance_m,
     nearest_clinic_distance_m, num_healthcare_facilities, population_affected, severity)
WITH care AS (
    SELECT name, type, geom::geography AS g
    FROM healthcare_facilities
    WHERE type IN {DESTINATION_CARE}
),
tract_metrics AS (
    SELECT
        t.census_tract_id,
        t.geom,
        t.population,
        ST_Centroid(t.geom)::geography AS centroid,
        -- nearest hospital distance (m)
        (SELECT MIN(ST_Distance(ST_Centroid(t.geom)::geography, c.g))
         FROM care c WHERE c.type = 'hospital') AS hosp_m,
        -- nearest clinic distance (m)
        (SELECT MIN(ST_Distance(ST_Centroid(t.geom)::geography, c.g))
         FROM care c WHERE c.type = 'clinic') AS clinic_m,
        -- destination-care facilities physically within this tract
        (SELECT COUNT(*) FROM healthcare_facilities f
         WHERE f.type IN {DESTINATION_CARE}
           AND ST_Within(f.geom, t.geom)) AS n_within
    FROM census_tracts t
    WHERE t.geom IS NOT NULL
)
SELECT
    census_tract_id,
    geom,
    -- access score (100 = best). Penalize distance to nearest hospital, scaled.
    GREATEST(0, LEAST(100,
        100 - (COALESCE(hosp_m, 20000) / 20000.0 * 100)
    ))::float AS healthcare_access_score,
    hosp_m   AS nearest_hospital_distance_m,
    clinic_m AS nearest_clinic_distance_m,
    n_within AS num_healthcare_facilities,
    CASE WHEN hosp_m > 5000 THEN population ELSE 0 END AS population_affected,
    CASE
        WHEN hosp_m IS NULL OR hosp_m > 10000 THEN 'critical'
        WHEN hosp_m > 5000 THEN 'high'
        WHEN hosp_m > 2000 THEN 'medium'
        ELSE 'low'
    END AS severity
FROM tract_metrics;
"""

with engine.begin() as conn:
    conn.execute(text(food_sql))
    conn.execute(text(health_sql))

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
with engine.connect() as conn:
    print("=== FOOD DESERT ZONES ===")
    fz_total = conn.execute(text("SELECT COUNT(*) FROM food_desert_zones")).scalar()
    print(f"Total zones: {fz_total}")
    for sev, n in conn.execute(text(
        "SELECT severity, COUNT(*) FROM food_desert_zones GROUP BY severity "
        "ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 "
        "WHEN 'medium' THEN 3 ELSE 4 END")).fetchall():
        print(f"  {sev:10s} {n}")
    print("Food access score (lower = worse) — worst 3:")
    for r in conn.execute(text(
        "SELECT census_tract_id, ROUND(food_access_score::numeric,1), severity "
        "FROM food_desert_zones ORDER BY food_access_score ASC LIMIT 3")).fetchall():
        print(f"  {r[0]}  score={r[1]}  ({r[2]})")
    # New columns populated from food_access_points (Task 1, step 5)
    print("Grocery distance/count coverage:")
    cov = conn.execute(text(
        "SELECT "
        "  COUNT(*) FILTER (WHERE nearest_grocery_distance_m IS NOT NULL), "
        "  COUNT(*) FILTER (WHERE nearest_grocery_distance_m IS NULL), "
        "  ROUND(AVG(nearest_grocery_distance_m)::numeric, 0), "
        "  ROUND(MAX(nearest_grocery_distance_m)::numeric, 0), "
        "  SUM(num_food_access_points), "
        "  COUNT(*) FILTER (WHERE num_food_access_points = 0) "
        "FROM food_desert_zones")).fetchone()
    print(f"  tracts with grocery distance: {cov[0]} (NULL: {cov[1]})")
    print(f"  avg distance to nearest grocery: {cov[2]} m   max: {cov[3]} m")
    print(f"  total grocery points within tracts: {cov[4]}   tracts with 0 groceries: {cov[5]}")
    print("Farthest-from-grocery tracts (m):")
    for r in conn.execute(text(
        "SELECT census_tract_id, ROUND(nearest_grocery_distance_m::numeric,0), severity "
        "FROM food_desert_zones WHERE nearest_grocery_distance_m IS NOT NULL "
        "ORDER BY nearest_grocery_distance_m DESC LIMIT 3")).fetchall():
        print(f"  {r[0]}  {r[1]} m  ({r[2]})")

    print("\n=== HEALTHCARE DESERT ZONES ===")
    hz_total = conn.execute(text("SELECT COUNT(*) FROM healthcare_desert_zones")).scalar()
    print(f"Total zones: {hz_total}")
    for sev, n in conn.execute(text(
        "SELECT severity, COUNT(*) FROM healthcare_desert_zones GROUP BY severity "
        "ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 "
        "WHEN 'medium' THEN 3 ELSE 4 END")).fetchall():
        print(f"  {sev:10s} {n}")
    print("Farthest-from-hospital tracts (m):")
    for r in conn.execute(text(
        "SELECT census_tract_id, ROUND(nearest_hospital_distance_m::numeric,0), severity "
        "FROM healthcare_desert_zones WHERE nearest_hospital_distance_m IS NOT NULL "
        "ORDER BY nearest_hospital_distance_m DESC LIMIT 3")).fetchall():
        print(f"  {r[0]}  {r[1]} m  ({r[2]})")