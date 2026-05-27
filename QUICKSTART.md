# Quick Start Guide

Get the geospatial dashboard running locally.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ & npm
- Python 3.10+ with the data-pipeline dependencies (`pip install -r data/requirements.txt`)
- A free Mapbox token (https://account.mapbox.com)
- Source data files downloaded locally (see "Data" below) — they are large and not committed

## 1. Start the database stack

```bash
docker compose up -d        # PostgreSQL + PostGIS, Redis, pgAdmin
sleep 10                     # wait for PostGIS health check
```

## 2. Configure the pipeline connection

Create `data/.env` (gitignored) with your database credentials:

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=geospatial_db
PGUSER=geospatial_user
PGPASSWORD=your_password
```

## 3. Download the source data

The pipeline reads real public datasets that are too large to commit. Download them and point the stage scripts at their local paths:

- **Census tract geometry** — TIGER/Line 2010, California (`tl_2010_06_tract10`)
- **Food-access metrics** — USDA Food Access Research Atlas 2019
- **Healthcare facilities** — California HCAI / CDPH licensed & certified facility locations

## 4. Run the pipeline (staged)

Each stage verifies its output before the next builds on it.

```bash
# Inspection / verification (optional — load nothing, just confirm the data)
python data/stage1_read_tracts.py     # tract count + CRS check
python data/stage2_read_atlas.py      # GEOID join-integrity check

# Loaders
python data/stage3_load_tracts.py     # census_tracts (polygons + Atlas attrs)
python data/stage4_load_healthcare.py # healthcare_facilities (points, tract-tagged)
python data/stage5_compute_zones.py   # food_desert_zones + healthcare_desert_zones
```

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
```

**API endpoints** (with the dev server running):
```bash
curl "http://localhost:3000/api/data/food-deserts?bounds=-122.6,37.2,-121.7,38.0"
curl "http://localhost:3000/api/data/healthcare?bounds=-122.6,37.2,-121.7,38.0"
```
Both should return GeoJSON FeatureCollections. The `food-access` endpoint returns an empty collection until grocery-point data is loaded (see README "Future work").

## Troubleshooting

**PostgreSQL connection refused** — check the container: `docker compose ps`; restart with `docker compose restart postgres`.

**Mapbox token error** — ensure `NEXT_PUBLIC_MAPBOX_TOKEN` is set in `frontend/.env.local`.

**Port 3000 in use** — `PORT=3001 npm run dev`.

**Reloading data** — the loaders truncate their tables before inserting, so re-running any stage is safe and idempotent. To rebuild the whole schema from scratch, `docker compose down -v && docker compose up -d` re-runs `scripts/init.sql`.

## Project structure

```
geospatial-dashboard/
├── frontend/                 # Next.js 16 app (App Router)
│   └── app/
│       ├── components/       # Map.tsx, Sidebar.tsx
│       ├── api/data/         # food-deserts, healthcare, food-access routes
│       ├── lib/              # store (Zustand), geo helpers
│       └── page.tsx
├── data/
│   ├── stage1_read_tracts.py … stage5_compute_zones.py   # staged pipeline
│   └── requirements.txt
├── scripts/init.sql          # schema + spatial indexes
├── docker-compose.yml
├── README.md
└── QUICKSTART.md
```