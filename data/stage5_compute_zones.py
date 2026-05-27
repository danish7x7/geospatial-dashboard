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
# ---------------------------------------------------------------------------
food_sql = """
TRUNCATE food_desert_zones RESTART IDENTITY;
INSERT INTO food_desert_zones
    (census_tract_id, geom, food_access_score, nearest_grocery_distance_m,
     num_food_access_points, population_affected, severity)
SELECT
    t.census_tract_id,
    t.geom,
    -- Continuous composite (100 = best access). Weighted penalties, clamped 0-100.
    GREATEST(0, LEAST(100,
        100
        - (CASE WHEN t.is_low_access THEN 40 ELSE 0 END)
        - (CASE WHEN t.is_low_income THEN 30 ELSE 0 END)
        - (COALESCE(t.pct_without_vehicle, 0) / 100.0 * 20)
        - (COALESCE(t.pct_snap, 0) / 100.0 * 10)
    ))::float AS food_access_score,
    NULL::float AS nearest_grocery_distance_m,   -- requires grocery points (future)
    NULL::int   AS num_food_access_points,        -- requires grocery points (future)
    CASE
        WHEN t.is_food_desert THEN t.population
        WHEN t.is_low_access  THEN t.population
        ELSE 0
    END AS population_affected,
    CASE
        WHEN t.is_food_desert THEN 'critical'     -- low-income AND low-access
        WHEN t.is_low_access  THEN 'high'          -- low-access only
        WHEN t.is_low_income  THEN 'medium'        -- low-income only
        ELSE 'low'
    END AS severity
FROM census_tracts t
WHERE t.geom IS NOT NULL;
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
