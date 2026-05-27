# data/stage1_read_tracts.py — read TIGER 2010 CA tracts, filter to Bay Area, inspect
import geopandas as gpd

TRACT_SHP = "/mnt/c/Users/danis/Downloads/tl_2010_06_tract10/tl_2010_06_tract10.shp"

# Bay Area county FIPS (3-digit, within state 06 = California)
BAY_AREA_COUNTY_FIPS = {"001", "013", "041", "055", "075", "081", "085", "095", "097"}

gdf = gpd.read_file(TRACT_SHP)

print("=== RAW FILE ===")
print(f"Total tracts in California file: {len(gdf)}")
print(f"Columns: {list(gdf.columns)}")
print(f"CRS (coordinate system): {gdf.crs}")
print(gdf[["STATEFP10", "COUNTYFP10", "TRACTCE10", "GEOID10"]].head(3).to_string())

# Filter to Bay Area counties
bay = gdf[gdf["COUNTYFP10"].isin(BAY_AREA_COUNTY_FIPS)].copy()

print("\n=== BAY AREA FILTER ===")
print(f"Bay Area tracts: {len(bay)}  (expect ~1,500-1,600)")
print("\nTracts per county (FIPS -> count):")
print(bay["COUNTYFP10"].value_counts().sort_index().to_string())
print(f"\nSample GEOID10 values: {bay['GEOID10'].head(3).tolist()}")
print(f"GEOID10 dtype: {bay['GEOID10'].dtype}  (should be 'object' = string)")
