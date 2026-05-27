# data/stage4_load_healthcare.py — load Bay Area healthcare facilities with FAC_FDR mapping
import os
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

HEALTH_CSV = "/mnt/c/Users/danis/Downloads/health_facility_locations.csv"
BAY_AREA_FIPS5 = {"06001","06013","06041","06055","06075","06081","06085","06095","06097"}

engine = create_engine(
    f"postgresql+psycopg2://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}"
    f"@{os.environ['PGHOST']}:{os.environ['PGPORT']}/{os.environ['PGDATABASE']}"
)

# FAC_FDR rollup -> our enum. Keys UPPERCASE to match the real data.
FDR_MAP = {
    "GENERAL ACUTE CARE HOSPITAL": "hospital",
    "ACUTE PSYCHIATRIC HOSPITAL": "hospital",
    "CHEMICAL DEPENDENCY RECOVERY HOSPITAL": "hospital",
    "PRIMARY CARE CLINIC": "clinic",
    "SURGICAL CLINIC": "clinic",
    "REHABILITATION CLINIC": "clinic",
    "ALTERNATIVE BIRTHING CENTER": "clinic",
    "PSYCHOLOGY CLINIC": "mental_health",
    "CHRONIC DIALYSIS CLINIC": "dialysis",
    "SKILLED NURSING FACILITY": "long_term_care",
    "INTERMEDIATE CARE FACILITY": "long_term_care",
    "INTERMEDIATE CARE FACILITY-DD/H/N/CN/IID": "long_term_care",
    "CONGREGATE LIVING HEALTH FACILITY": "long_term_care",
    "PEDIATRIC DAY HEALTH & RESPITE CARE FACILITY": "long_term_care",
    "ADULT DAY HEALTH CARE": "long_term_care",
    "HOME HEALTH AGENCY": "hospice_home_health",
    "HOSPICE": "hospice_home_health",
    "HOSPICE FACILITY": "hospice_home_health",
    "CORRECTIONAL TREATMENT CENTER": "other",
    "REFERRAL AGENCY": "other",
    "OTHER": "other",
}
ALLOWED = set(FDR_MAP.values())

df = pd.read_csv(HEALTH_CSV, dtype=str, low_memory=False)
print(f"Raw rows (statewide): {len(df)}")

# Filter: Bay Area + open facilities + has coordinates
df = df[df["FIPS_COUNTY_CODE"].isin(BAY_AREA_FIPS5)]
print(f"After Bay Area filter: {len(df)}")
df = df[df["FAC_STATUS_TYPE_CODE"].str.upper() == "OPEN"]
print(f"After OPEN-only filter: {len(df)}")
df = df.dropna(subset=["LATITUDE", "LONGITUDE"])
df = df[(df["LATITUDE"].str.strip() != "") & (df["LONGITUDE"].str.strip() != "")]
print(f"After dropping missing coords: {len(df)}")

# Map category from FAC_FDR (normalize case on both sides)
df["type"] = df["FAC_FDR"].str.strip().str.upper().map(FDR_MAP).fillna("other")
unmapped = sorted(set(df.loc[df["type"]=="other","FAC_FDR"].dropna().str.strip().str.upper()) - set(FDR_MAP))
if unmapped:
    print(f"\n!! FAC_FDR values that fell through to 'other' (check these): {unmapped}")

# Derive fields
df["latitude"]  = df["LATITUDE"].astype(float)
df["longitude"] = df["LONGITUDE"].astype(float)
df["beds"] = pd.to_numeric(df["CAPACITY"], errors="coerce").astype("Int64")
df["accepts_medicaid"] = df["T18_19"].fillna("").str.contains("19")
df["name"] = df["FACNAME"].str.strip()
df["address"] = df["ADDRESS"].str.strip()
df["census_tract"] = None

# Sanity: coordinates inside Bay Area bbox
bad = df[(df["latitude"] < 36) | (df["latitude"] > 39) | (df["longitude"] > -121) | (df["longitude"] < -123.5)]
print(f"\nCoords outside Bay Area bbox (suspicious): {len(bad)}")

assert ALLOWED >= set(df["type"].unique()), f"Unexpected category: {set(df['type'].unique()) - ALLOWED}"

gdf = gpd.GeoDataFrame(
    df[["name","type","latitude","longitude","address","beds","accepts_medicaid"]],
    geometry=[Point(xy) for xy in zip(df["longitude"], df["latitude"])],
    crs="EPSG:4326",
)

# Spatial filter + tract tagging: keep only facilities inside a Bay Area tract,
# and stamp each with the census_tract_id it falls in.
tracts = gpd.read_postgis(
    "SELECT census_tract_id, geom FROM census_tracts", engine, geom_col="geom"
)
before = len(gdf)
gdf = gpd.sjoin(gdf, tracts, how="inner", predicate="within").drop(columns="index_right")
gdf = gdf.rename(columns={"census_tract_id": "census_tract"})
print(f"\nSpatial join: {before} -> {len(gdf)} facilities inside Bay Area tracts "
      f"({before - len(gdf)} dropped as outside)")

gdf = gdf[["name","type","latitude","longitude","address","census_tract",
           "beds","accepts_medicaid","geometry"]].rename_geometry("geom")

with engine.begin() as conn:
    conn.execute(text("TRUNCATE healthcare_facilities RESTART IDENTITY;"))
gdf.to_postgis("healthcare_facilities", engine, if_exists="append", index=False)

with engine.connect() as conn:
    total = conn.execute(text("SELECT COUNT(*) FROM healthcare_facilities")).scalar()
    by_type = conn.execute(text(
        "SELECT type, COUNT(*) FROM healthcare_facilities GROUP BY type ORDER BY COUNT(*) DESC")).fetchall()
    medicaid = conn.execute(text("SELECT COUNT(*) FROM healthcare_facilities WHERE accepts_medicaid")).scalar()
    with_beds = conn.execute(text("SELECT COUNT(*) FROM healthcare_facilities WHERE beds IS NOT NULL")).scalar()

print(f"\nLoaded facilities: {total}")
print("By category:")
for t, n in by_type:
    print(f"  {t:22s} {n}")
print(f"Accepts Medi-Cal (T19): {medicaid}")
print(f"Has bed count:          {with_beds}")