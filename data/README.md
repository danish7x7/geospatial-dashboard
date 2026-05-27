# Data Pipeline

Staged pipeline that loads real Bay Area data into PostGIS. Each stage verifies its output before the next builds on it.

## Stages

| Script | Writes | Purpose |
|--------|--------|---------|
| `stage1_read_tracts.py` | — | Read TIGER 2010 CA tracts, filter to the 9 Bay Area counties, check count + CRS |
| `stage2_read_atlas.py` | — | Read USDA Atlas, repair GEOID leading zeros, verify the GEOID set joins to TIGER |
| `stage3_load_tracts.py` | `census_tracts` | Reproject 4269→4326, join Atlas attributes, compute derived fields, load polygons |
| `stage4_load_healthcare.py` | `healthcare_facilities` | Filter to Bay Area, map facility types, spatially join points to tracts, load |
| `stage5_compute_zones.py` | `food_desert_zones`, `healthcare_desert_zones` | Derive severity + scores in PostGIS |

Stages 1–2 are inspection-only and optional. Stages 3–5 are the loaders and are idempotent (each truncates its table before inserting).

## Setup

```bash
pip install -r requirements.txt
```

Connection is read from `data/.env` (gitignored):

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=geospatial_db
PGUSER=geospatial_user
PGPASSWORD=your_password
```

## Source data

Downloaded locally (large, not committed) — see the top-level README for sources and the rationale behind the 2010 tract vintage and the California state healthcare source. Edit the file paths at the top of each stage script to point at your local downloads.