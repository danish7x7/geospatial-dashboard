"""
stage6_load_food_access.py

Load USDA SNAP Retailer Locator data into the food_access_points table.

Source: SNAP Retailer Location Data (ArcGIS Hub / FNS), national CSV
  ~255K rows; we filter to the 9 Bay Area counties.

Category mapping (USDA ERS food-access methodology):
  Supermarket, Super Store, Grocery Store  ->  grocery_store
  everything else                          ->  DROPPED

The Food Access Research Atlas (already powering is_food_desert) uses the same
definition. Excluding convenience/dollar/specialty stores keeps the two layers
methodologically consistent.

Pattern matches stage3/stage4: env -> read -> filter -> validate -> truncate -> load.
Idempotent: re-running fully replaces table contents.
"""

import os
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Resolve repo paths relative to this file so the script works from anywhere.
DATA_DIR = Path(__file__).resolve().parent
REPO_ROOT = DATA_DIR.parent

# USER: update this if the unzipped CSV lives elsewhere on your machine.
# The file is NOT in the repo (it's ~50MB+ national data); keep it in Downloads
# or wherever you put the other source files. Override via SNAP_CSV env var
# (e.g. in data/.env) if you prefer.
DEFAULT_SNAP_CSV = Path.home() / "downloads" / "snap_retailer_location_data.csv"


def resolve_snap_csv() -> Path:
    """Resolve SNAP CSV path at call time, AFTER load_dotenv has run.

    Resolving at import time would read os.environ before data/.env is loaded,
    silently falling back to DEFAULT_SNAP_CSV even when SNAP_CSV is set in .env.
    """
    return Path(os.environ.get("SNAP_CSV", DEFAULT_SNAP_CSV))

# Bay Area bounding box for cheap prefilter (rough; the spatial join is authoritative).
# Covers all 9 counties with margin.
BBOX_MIN_LNG, BBOX_MAX_LNG = -123.6, -121.2
BBOX_MIN_LAT, BBOX_MAX_LAT = 36.9, 38.9

# USDA-standard grocery store categories (from `cut -d',' -f12 | uniq -c`):
#   Supermarket (19,582), Super Store (20,566), Grocery Store (22,544)
# Everything else (Convenience Store, Other, Restaurant Meals Program,
# Farmers and Markets, Specialty Store) is dropped per ERS methodology.
GROCERY_STORE_TYPES = {"Supermarket", "Super Store", "Grocery Store"}

# food_access_points.type enum values (from scripts/init.sql).
VALID_TYPES = {"grocery_store", "farmers_market", "food_pantry", "community_garden"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"[stage6] {msg}", flush=True)


def get_engine():
    """Build SQLAlchemy engine from data/.env, matching stage3/stage4."""
    load_dotenv(DATA_DIR / ".env")
    host = os.environ["PGHOST"]
    port = os.environ.get("PGPORT", "5432")
    db = os.environ["PGDATABASE"]
    user = os.environ["PGUSER"]
    pw = os.environ["PGPASSWORD"]
    return create_engine(f"postgresql+psycopg2://{user}:{pw}@{host}:{port}/{db}")


def load_snap_csv(path: Path) -> pd.DataFrame:
    """Read national SNAP CSV with safe dtypes.

    - Zip_Code/Zip4 as string to preserve leading zeros (defensive; not stored).
    - Lat/Lng as float; we'll drop rows where they fail to parse.
    - Treat 'NULL' as NA, consistent with the Atlas convention.
    """
    if not path.exists():
        log(f"ERROR: SNAP CSV not found at {path}")
        log("Set SNAP_CSV=/path/to/snap_retailer_location_data.csv or update DEFAULT_SNAP_CSV.")
        sys.exit(1)

    log(f"reading {path}")
    df = pd.read_csv(
        path,
        dtype={
            "Zip_Code": str,
            "Zip4": str,
            "Store_Name": str,
            "Store_Street_Address": str,
            "Additonal_Address": str,  # sic: misspelled in source
            "City": str,
            "State": str,
            "County": str,
            "Store_Type": str,
            "Incentive_Program": str,
            "Grantee_Name": str,
        },
        na_values=["NULL", ""],
        low_memory=False,
    )
    log(f"  loaded {len(df):,} rows")
    return df


def filter_to_bay_area_bbox(df: pd.DataFrame) -> pd.DataFrame:
    """Cheap lat/lng bbox prefilter before the spatial join.

    Cuts 255K rows down to a few thousand so the spatial join is fast.
    The spatial join later is the authoritative filter; this is just an optimization.
    """
    before = len(df)

    # Drop rows missing coords up front.
    df = df.dropna(subset=["Latitude", "Longitude"]).copy()
    df["Latitude"] = pd.to_numeric(df["Latitude"], errors="coerce")
    df["Longitude"] = pd.to_numeric(df["Longitude"], errors="coerce")
    df = df.dropna(subset=["Latitude", "Longitude"])

    df = df[
        (df["Longitude"] >= BBOX_MIN_LNG)
        & (df["Longitude"] <= BBOX_MAX_LNG)
        & (df["Latitude"] >= BBOX_MIN_LAT)
        & (df["Latitude"] <= BBOX_MAX_LAT)
    ].copy()

    log(f"  bbox prefilter: {before:,} -> {len(df):,} rows")
    return df


def filter_to_grocery_stores(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only USDA-standard grocery categories. Drop the rest."""
    before = len(df)

    # Strip whitespace defensively (don't trust source CSV formatting).
    df = df.copy()
    df["Store_Type"] = df["Store_Type"].fillna("").str.strip()

    by_type = df["Store_Type"].value_counts(dropna=False)
    log("  store type breakdown (Bay Area, pre-category-filter):")
    for store_type, count in by_type.items():
        keep = "KEEP" if store_type in GROCERY_STORE_TYPES else "drop"
        log(f"    [{keep}] {store_type or '(blank)'}: {count:,}")

    df = df[df["Store_Type"].isin(GROCERY_STORE_TYPES)].copy()
    log(f"  category filter: {before:,} -> {len(df):,} rows")
    return df


def dedupe(df: pd.DataFrame) -> pd.DataFrame:
    """Same retailer can reappear at slightly different coords across re-auths."""
    before = len(df)
    df = df.drop_duplicates(
        subset=["Store_Name", "Store_Street_Address", "City", "Zip_Code"],
        keep="first",
    )
    dropped = before - len(df)
    if dropped:
        log(f"  deduped: dropped {dropped:,} rows")
    return df


def build_address(row: pd.Series) -> str:
    """Single-line address for popups (Task 2)."""
    parts = [
        str(row.get("Store_Street_Address") or "").strip(),
        str(row.get("City") or "").strip(),
        str(row.get("State") or "").strip(),
        str(row.get("Zip_Code") or "").strip(),
    ]
    return ", ".join(p for p in parts if p)


def to_geodataframe(df: pd.DataFrame) -> gpd.GeoDataFrame:
    """Build a GeoDataFrame in EPSG:4326 with the schema's column names."""
    out = pd.DataFrame(
        {
            "name": df["Store_Name"].fillna("").str.strip(),
            "type": "grocery_store",  # all rows are grocery_store after the filter
            "latitude": df["Latitude"],
            "longitude": df["Longitude"],
            "address": df.apply(build_address, axis=1),
        }
    )
    # Strict validation before insert - fail loudly on garbage.
    bad_type = ~out["type"].isin(VALID_TYPES)
    if bad_type.any():
        raise ValueError(f"{bad_type.sum()} rows have a type outside the enum")
    bad_name = out["name"].eq("")
    if bad_name.any():
        log(f"  WARN: {bad_name.sum()} rows have empty name; dropping")
        out = out[~bad_name].copy()

    gdf = gpd.GeoDataFrame(
        out,
        geometry=gpd.points_from_xy(out["longitude"], out["latitude"]),  # lng, lat order
        crs="EPSG:4326",
    )
    return gdf.rename_geometry("geom")  # schema uses 'geom' not 'geometry'


def spatial_join_to_tracts(gdf: gpd.GeoDataFrame, engine) -> gpd.GeoDataFrame:
    """Authoritative Bay Area filter via spatial join against census_tracts.

    Drops anything outside a Bay Area tract (the only tracts in the table) and
    tags each surviving point with its census_tract_id, same pattern as stage4.
    """
    log("  spatial join to census_tracts (authoritative Bay Area filter)")
    tracts = gpd.read_postgis(
        "SELECT id AS census_tract, geom FROM census_tracts",
        engine,
        geom_col="geom",
    )
    before = len(gdf)
    joined = gpd.sjoin(gdf, tracts, how="inner", predicate="within")
    # sjoin adds index_right; drop it. Keep census_tract.
    joined = joined.drop(columns=[c for c in ["index_right"] if c in joined.columns])
    log(f"  spatial join: {before:,} -> {len(joined):,} rows (dropped {before - len(joined):,} outside Bay Area)")
    return joined


def load_to_db(gdf: gpd.GeoDataFrame, engine) -> None:
    """Truncate then append. Idempotent re-runs match stage3/stage4."""
    log("  truncating food_access_points")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE food_access_points RESTART IDENTITY CASCADE"))

    log(f"  inserting {len(gdf):,} rows into food_access_points")
    gdf.to_postgis(
        "food_access_points",
        engine,
        if_exists="append",
        index=False,
    )

    # Sanity check.
    with engine.connect() as conn:
        n = conn.execute(text("SELECT COUNT(*) FROM food_access_points")).scalar()
        by_type = conn.execute(
            text("SELECT type, COUNT(*) FROM food_access_points GROUP BY type ORDER BY 2 DESC")
        ).all()
    log(f"  food_access_points now has {n:,} rows")
    for t, c in by_type:
        log(f"    {t}: {c:,}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    engine = get_engine()  # also runs load_dotenv()
    snap_csv = resolve_snap_csv()  # now safe - .env is loaded
    df = load_snap_csv(snap_csv)
    df = filter_to_bay_area_bbox(df)
    df = filter_to_grocery_stores(df)
    df = dedupe(df)
    gdf = to_geodataframe(df)
    gdf = spatial_join_to_tracts(gdf, engine)
    load_to_db(gdf, engine)
    log("done.")


if __name__ == "__main__":
    main()