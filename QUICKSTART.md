# Quick Start Guide

Get the geospatial dashboard running locally.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ & npm
- Python 3.10+ with the data-pipeline dependencies (`pip install -r data/requirements.txt`)
- A free Mapbox token (https://account.mapbox.com)
- Source data files downloaded locally (see "Data" below) - they are large and not committed

## 1. Start the database stack

```bash
docker compose up -d        # PostgreSQL + PostGIS, Redis, pgAdmin
sleep 10                     # wait for PostGIS health check
```

## 2. Configure the pipeline connection

Create `data/.env` (gitignored) with your database credentials AND the SNAP CSV path:

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=geospatial_db
PGUSER=geospatial_user
PGPASSWORD=your_password
SNAP_CSV=/absolute/path/to/snap_retailer_location_data.csv
```

`SNAP_CSV` points to the unzipped national SNAP file (Step 3). The other source files have their paths hard-coded inside the relevant stage scripts; edit those paths to match your local layout if needed.

## 3. Download the source data

The pipeline reads real public datasets that are too large to commit. Download them locally:

- **Census tract geometry** - TIGER/Line 2010, California (`tl_2010_06_tract10`)
  https://www.census.gov/cgi-bin/geo/shapefiles/index.php
- **Food-access metrics** - USDA Food Access Research Atlas 2019
  https://www.ers.usda.gov/data-products/food-access-research-atlas/
- **Grocery stores** - USDA SNAP Retailer Locator Data
  https://www.fns.usda.gov/snap/retailer-locator
- **Healthcare facilities** - California HCAI / CDPH licensed & certified facility locations
  https://hcai.ca.gov/

## 4. Run the pipeline (staged)

Each stage truncates its target table before loading, so re-running any stage is safe and idempotent. Order matters: stage5 derives `nearest_grocery_distance_m` from points stage6 loads, so run stage6 before stage5.

```bash
# Inspection / verification (optional - load nothing, just confirm the data)
python data/stage1_read_tracts.py     # tract count + CRS check
python data/stage2_read_atlas.py      # GEOID join-integrity check

# Loaders
python data/stage3_load_tracts.py        # census_tracts (~1,588 polygons + Atlas attrs)
python data/stage4_load_healthcare.py    # healthcare_facilities (~1,930 points, tract-tagged)
python data/stage6_load_food_access.py   # food_access_points (~1,514 grocery stores)
python data/stage5_compute_zones.py      # food_desert_zones + healthcare_desert_zones (runs LAST)
```

Stage 6 reads the national SNAP CSV (255K rows), applies a Bay Area bbox prefilter, filters to USDA-defined grocery categories (Supermarket / Super Store / Grocery Store), dedupes, spatially joins to tracts, and loads ~1,514 points.

## 5. Start the frontend

```bash
cd frontend
npm install
# .env.local: Mapbox token + DB connection
echo 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here' > .env.local
cat >> .env.local <<'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geospatial_db
DB_USER=geospatial_user
DB_PASSWORD=your_password
EOF
npm run dev
```

Visit **http://localhost:3000**.

## Verifying setup

**Database connection:**
```bash
psql -h localhost -U geospatial_user -d geospatial_db -c "SELECT COUNT(*) FROM census_tracts;"
# expect ~1588

psql -h localhost -U geospatial_user -d geospatial_db -c "SELECT COUNT(*) FROM food_access_points;"
# expect ~1514 grocery stores

psql -h localhost -U geospatial_user -d geospatial_db -c "
  SELECT severity, COUNT(*) FROM food_desert_zones GROUP BY severity ORDER BY 2 DESC;"
# expect: low 804, medium 444, high 297, critical 43
```

**API endpoints** (with the dev server running):
```bash
curl "http://localhost:3000/api/data/food-deserts?bounds=-122.6,37.2,-121.7,38.0" | head -c 200
curl "http://localhost:3000/api/data/healthcare?bounds=-122.6,37.2,-121.7,38.0" | head -c 200
curl "http://localhost:3000/api/data/food-access?bounds=-122.6,37.2,-121.7,38.0" | head -c 200
curl "http://localhost:3000/api/data/double-burden" | head -c 400
```

All four should return JSON. The first three return GeoJSON `FeatureCollection`s; double-burden also includes `totals` and (when `bounds` is given) `viewport`.

## Troubleshooting

**PostgreSQL connection refused** - check the container: `docker compose ps`; restart with `docker compose restart postgres`.

**Mapbox token error** - ensure `NEXT_PUBLIC_MAPBOX_TOKEN` is set in `frontend/.env.local`.

**Port 3000 in use** - `PORT=3001 npm run dev`.

**Stage 6 says "SNAP CSV not found"** - `SNAP_CSV` in `data/.env` must be an absolute path to the unzipped CSV. On WSL accessing Windows Downloads, that's `/mnt/c/Users/yourname/Downloads/snap_retailer_location_data.csv`.

**Reloading data** - the loaders truncate their tables before inserting, so re-running any stage is safe. To rebuild the whole schema from scratch, `docker compose down -v && docker compose up -d` re-runs `scripts/init.sql`.

## Project structure

```
geospatial-dashboard/
├── frontend/                 # Next.js 16 app (App Router)
│   └── app/
│       ├── components/       # Map.tsx, Sidebar.tsx, PinnedPopup.tsx
│       ├── api/data/         # food-deserts, healthcare, food-access, double-burden
│       ├── lib/              # store (Zustand), geo helpers
│       └── page.tsx
├── data/
│   ├── stage1_read_tracts.py … stage6_load_food_access.py   # staged pipeline
│   └── requirements.txt
├── scripts/init.sql          # schema + spatial indexes
├── docker-compose.yml
├── README.md
└── QUICKSTART.md
```