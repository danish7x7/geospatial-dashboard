# data/stage3_load_tracts.py — load real census_tracts into PostGIS
import os
import geopandas as gpd
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from shapely import MultiPolygon, Polygon

load_dotenv()

TRACT_SHP = "/mnt/c/Users/danis/Downloads/tl_2010_06_tract10/tl_2010_06_tract10.shp"
ATLAS_CSV = "/mnt/c/Users/danis/Downloads/2019_Food_Access_Research_Atlas_Data/Food Access Research Atlas.csv"
BAY_AREA_COUNTY_FIPS = {"001", "013", "041", "055", "075", "081", "085", "095", "097"}

engine = create_engine(
    f"postgresql+psycopg2://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}"
    f"@{os.environ['PGHOST']}:{os.environ['PGPORT']}/{os.environ['PGDATABASE']}"
)

# --- 1. Read + filter + reproject tracts ---
tracts = gpd.read_file(TRACT_SHP)
tracts = tracts[tracts["COUNTYFP10"].isin(BAY_AREA_COUNTY_FIPS)].copy()
tracts = tracts.to_crs(4326)   # 4269 (NAD83) -> 4326 (WGS84) to match schema
print(f"Tracts after filter+reproject: {len(tracts)}  CRS={tracts.crs}")

# --- 2. Read Atlas, fix zero-pad, NULL handling ---
atlas = pd.read_csv(ATLAS_CSV, dtype={"CensusTract": str}, na_values=["NULL"], low_memory=False)
atlas["CensusTract"] = atlas["CensusTract"].str.zfill(11)

# --- 3. Compute derived Atlas attributes ---
# pct_without_vehicle (guard divide-by-zero; clamp dirty rows where numerator > denominator)
pct = atlas["TractHUNV"] / atlas["OHU2010"].where(atlas["OHU2010"] > 0) * 100
atlas["pct_without_vehicle"] = pct.clip(upper=100)

# Food-access flags from the Atlas (drive food_desert_zones in Stage 5)
atlas["is_low_access"] = atlas["LATracts1"] == 1
atlas["is_low_income"] = atlas["LowIncomeTracts"] == 1
atlas["is_food_desert"] = atlas["LILATracts_1And10"] == 1   # low-income AND low-access
atlas["pct_snap"] = (
    atlas["TractSNAP"] / atlas["OHU2010"].where(atlas["OHU2010"] > 0) * 100
).clip(upper=100)

# --- 4. Build the load frame: geometry from TIGER + attrs from Atlas ---
keep = atlas[["CensusTract", "Pop2010", "MedianFamilyIncome", "PovertyRate",
              "pct_without_vehicle", "is_low_access", "is_low_income",
              "is_food_desert", "pct_snap"]]
gdf = tracts.merge(keep, left_on="GEOID10", right_on="CensusTract", how="left")

gdf["census_tract_id"] = gdf["GEOID10"]
gdf["state_fips"]  = gdf["STATEFP10"]
gdf["county_fips"] = gdf["COUNTYFP10"]
gdf["tract_fips"]  = gdf["TRACTCE10"]
gdf = gdf.rename(columns={
    "Pop2010": "population",
    "MedianFamilyIncome": "median_income",
    "PovertyRate": "poverty_rate",
})

# Nullable-int for population/income (pandas: avoid float NaN -> keep clean ints)
gdf["population"]    = gdf["population"].astype("Int64")
gdf["median_income"] = gdf["median_income"].astype("Int64")

out = gdf[["census_tract_id", "state_fips", "county_fips", "tract_fips",
           "geometry", "population", "median_income", "poverty_rate",
           "pct_without_vehicle", "is_low_access", "is_low_income",
           "is_food_desert", "pct_snap"]].set_geometry("geometry")
out = out.rename_geometry("geom")

out["geom"] = out["geom"].apply(
    lambda g: MultiPolygon([g]) if isinstance(g, Polygon) else g
)

# --- 5. Truncate + load ---
with engine.begin() as conn:
    conn.execute(text("TRUNCATE census_tracts RESTART IDENTITY CASCADE;"))

out.to_postgis("census_tracts", engine, if_exists="append", index=False)

# --- 6. Verify what landed ---
with engine.connect() as conn:
    total = conn.execute(text("SELECT COUNT(*) FROM census_tracts")).scalar()
    with_pop = conn.execute(text("SELECT COUNT(*) FROM census_tracts WHERE population IS NOT NULL")).scalar()
    no_attr = conn.execute(text("SELECT COUNT(*) FROM census_tracts WHERE poverty_rate IS NULL")).scalar()
    srid = conn.execute(text("SELECT DISTINCT ST_SRID(geom) FROM census_tracts")).scalar()
    food_deserts = conn.execute(text("SELECT COUNT(*) FROM census_tracts WHERE is_food_desert")).scalar()
    low_access = conn.execute(text("SELECT COUNT(*) FROM census_tracts WHERE is_low_access")).scalar()
    low_income = conn.execute(text("SELECT COUNT(*) FROM census_tracts WHERE is_low_income")).scalar()
    sample = conn.execute(text(
        "SELECT census_tract_id, population, median_income, poverty_rate, "
        "ROUND(pct_without_vehicle::numeric,1) FROM census_tracts "
        "WHERE poverty_rate IS NOT NULL ORDER BY poverty_rate DESC LIMIT 3"
    )).fetchall()

print(f"\nLoaded rows:        {total}   (expect 1588)")
print(f"With population:    {with_pop}")
print(f"Missing attrs (the geometry-only tracts): {no_attr}  (expect ~8)")
print(f"Geometry SRID:      {srid}   (expect 4326)")
print(f"\nFood-access flags:")
print(f"  Food deserts (low-income AND low-access): {food_deserts}")
print(f"  Low-access tracts:                        {low_access}")
print(f"  Low-income tracts:                        {low_income}")
print(f"\nHighest-poverty tracts loaded:")
for r in sample:
    print(f"  {r[0]}  pop={r[1]}  income=${r[2]}  poverty={r[3]}%  no_vehicle={r[4]}%")