# data/stage2_read_atlas.py — read USDA Atlas, fix GEOID zero-pad, verify join vs TIGER
import geopandas as gpd
import pandas as pd

TRACT_SHP = "/mnt/c/Users/danis/Downloads/tl_2010_06_tract10/tl_2010_06_tract10.shp"
ATLAS_CSV = "/mnt/c/Users/danis/Downloads/2019_Food_Access_Research_Atlas_Data/Food Access Research Atlas.csv"

BAY_AREA_COUNTY_FIPS = {"001", "013", "041", "055", "075", "081", "085", "095", "097"}

# --- TIGER GEOIDs (the truth set for the join) ---
tracts = gpd.read_file(TRACT_SHP)
tracts_bay = tracts[tracts["COUNTYFP10"].isin(BAY_AREA_COUNTY_FIPS)]
tiger_geoids = set(tracts_bay["GEOID10"])

# --- Atlas: read CensusTract as STRING, treat 'NULL' as missing ---
atlas = pd.read_csv(
    ATLAS_CSV,
    dtype={"CensusTract": str},   # critical: don't let pandas eat the leading zero
    na_values=["NULL"],            # the literal text NULL -> real NaN
    low_memory=False,
)

print("=== ATLAS RAW ===")
print(f"Total rows (all US tracts): {len(atlas)}")
print(f"Raw CensusTract samples: {atlas['CensusTract'].head(3).tolist()}")
print(f"CensusTract string lengths seen: {sorted(atlas['CensusTract'].str.len().unique())}")

# --- Fix the leading-zero: pad to 11 chars ---
atlas["CensusTract"] = atlas["CensusTract"].str.zfill(11)
print(f"\nAfter zfill(11): {atlas['CensusTract'].head(3).tolist()}")
print(f"Lengths after pad: {sorted(atlas['CensusTract'].str.len().unique())}  (want just [11])")

# --- Filter Atlas to Bay Area (state 06 + our counties) ---
atlas_bay = atlas[atlas["CensusTract"].str[:5].isin({"06" + c for c in BAY_AREA_COUNTY_FIPS})].copy()
atlas_geoids = set(atlas_bay["CensusTract"])

print("\n=== BAY AREA ATLAS ===")
print(f"Atlas Bay Area rows: {len(atlas_bay)}")

# --- THE CRITICAL CHECK: do the two GEOID sets line up? ---
overlap = tiger_geoids & atlas_geoids
print("\n=== JOIN INTEGRITY ===")
print(f"TIGER Bay Area tracts:  {len(tiger_geoids)}")
print(f"Atlas Bay Area tracts:  {len(atlas_geoids)}")
print(f"GEOIDs in BOTH:         {len(overlap)}   <-- want close to {len(tiger_geoids)}")
print(f"In TIGER but not Atlas: {len(tiger_geoids - atlas_geoids)}")
print(f"In Atlas but not TIGER: {len(atlas_geoids - tiger_geoids)}")

# --- Peek at the columns we'll actually load ---
cols = ["CensusTract", "Pop2010", "OHU2010", "PovertyRate", "MedianFamilyIncome",
        "TractHUNV", "LILATracts_1And10", "LowIncomeTracts", "LATracts1", "LATracts10"]
print("\n=== SAMPLE OF LOAD COLUMNS (first 3 Bay Area rows) ===")
print(atlas_bay[cols].head(3).to_string())

