# 🗺️ Spatial Inequality Dashboard

A full-stack geospatial intelligence platform visualizing food deserts and healthcare access disparities across the United States. Built with modern web technologies to expose real-world inequalities in food and healthcare access.

## 🎯 Mission

This project demonstrates how geospatial data and visualization can be used to understand and address social inequality. It visualizes:

- **Food Deserts**: Areas with limited access to affordable, healthy food
- **Healthcare Access**: Distribution of medical facilities and equity in healthcare access
- **Social Impact**: How poverty and mobility correlate with resource availability

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React + Deck.gl Frontend              │
│            (Geospatial Visualization Layer)             │
└────────────────────┬────────────────────────────────────┘
                     │ API Calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│          Next.js 14 API Routes + TypeScript             │
│         (PostGIS Queries, Data Aggregation)             │
└────────────────────┬────────────────────────────────────┘
                     │ SQL Queries
                     ▼
┌─────────────────────────────────────────────────────────┐
│      PostgreSQL + PostGIS (Spatial Database)            │
│   (Geometric Indexing, Distance Calculations, etc.)     │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

**Frontend:**
- Next.js 14 (App Router, TypeScript)
- Deck.gl 9.0 (GPU-accelerated geospatial visualization)
- Mapbox GL (basemap rendering)
- Zustand (state management)
- Tailwind CSS + Framer Motion (styling & animations)
- Axios (HTTP client)

**Backend:**
- Node.js + Express (via Next.js API routes)
- TypeScript (type safety)
- pg (PostgreSQL driver)

**Database:**
- PostgreSQL 16 + PostGIS 3.4 (spatial database)
- Redis (tile caching, future optimization)
- Docker Compose (local development)

**Data Processing:**
- Python 3.10+ (data pipeline)
- GDAL/Rasterio (geospatial data handling)
- GeoPandas (spatial data frames)
- Tippecanoe (vector tile generation)

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ & npm
- Python 3.10+ (for data processing)
- Git

### Quick Start (Docker)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/geospatial-dashboard.git
cd geospatial-dashboard

# 2. Start PostgreSQL + PostGIS + Redis
docker-compose up -d

# 3. Wait for database to be ready
sleep 10

# 4. Load sample data
python data/load_data.py

# 5. Install frontend dependencies
cd frontend
npm install

# 6. Set up environment
echo 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token' > .env.local

# 7. Start dev server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Environment Variables

**Frontend (.env.local):**
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token
```

**Backend (implicit from docker-compose.yml):**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geospatial_db
DB_USER=geospatial_user
DB_PASSWORD=geospatial_pass
```

## 📊 Data Schema

### Tables

#### `food_access_points`
Locations with food access (grocery stores, farmers markets, food pantries, community gardens).

```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255)
- type: VARCHAR(50) -- 'grocery_store', 'farmers_market', 'food_pantry', 'community_garden'
- geom: GEOMETRY(Point, 4326)
- address: VARCHAR(255)
```

#### `healthcare_facilities`
Medical facilities (hospitals, clinics, urgent care, dental, mental health).

```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255)
- type: VARCHAR(50)
- geom: GEOMETRY(Point, 4326)
- beds: INTEGER
- accepts_medicaid: BOOLEAN
```

#### `food_desert_zones`
Derived zones indicating food access disparities.

```sql
- id: SERIAL PRIMARY KEY
- geom: GEOMETRY(Polygon, 4326)
- food_access_score: FLOAT (0-100)
- nearest_grocery_distance_m: FLOAT
- severity: VARCHAR(20) -- 'low', 'medium', 'high', 'critical'
```

### Spatial Indexes

All geometry columns have GiST indexes for fast spatial queries:
```sql
CREATE INDEX idx_geom ON table_name USING GIST(geom);
```

## 🔍 Key Features

### 1. **Tile-Based Rendering**
- Deck.gl layers only render visible features
- Viewport-based data fetching reduces bandwidth
- Efficient spatial indexing with PostGIS

### 2. **Real-Time Filtering**
- Toggle layers on/off
- Filter by severity, type, medicaid acceptance
- Responsive to map bounds

### 3. **Spatial Analysis**
- Distance calculations (PostGIS ST_Distance)
- Intersection queries (ST_Intersects, ST_DWithin)
- Polygon aggregation for census tracts

### 4. **Interactive Map**
- Pan, zoom, rotate with Mapbox GL
- Click/hover for feature details
- Color-coded by severity & type
- Custom legends

## 📈 API Endpoints

### Food Deserts
```
GET /api/data/food-deserts?severity=critical&bounds=minLng,minLat,maxLng,maxLat
```

### Healthcare Facilities
```
GET /api/data/healthcare?type=hospital&accepts_medicaid=true&bounds=...
```

### Food Access Points
```
GET /api/data/food-access?type=grocery_store&bounds=...
```

All endpoints return GeoJSON FeatureCollections.

## 🗄️ Database Operations

### Query Examples

**Find food deserts within 5km:**
```sql
SELECT * FROM food_desert_zones
WHERE ST_DWithin(geom::geography, ST_Point(-122.4194, 37.7749)::geography, 5000)
AND severity = 'critical';
```

**Count hospitals by county:**
```sql
SELECT county, COUNT(*) as hospital_count
FROM healthcare_facilities
WHERE type = 'hospital'
GROUP BY county;
```

**Distance to nearest grocery store:**
```sql
SELECT name, ST_Distance(geom::geography, grocery.geom::geography) as distance_m
FROM food_desert_zones
CROSS JOIN LATERAL (
  SELECT geom FROM food_access_points
  WHERE type = 'grocery_store'
  ORDER BY geom <-> food_desert_zones.geom
  LIMIT 1
) grocery;
```

## 🎨 Visualization Design

### Color Scheme
- **Food Deserts**: Red (critical) → Orange → Yellow → Green (healthy)
- **Healthcare**: Blue (hospital) → Cyan (clinic) → Orange (urgent care)
- **Food Access**: Green shades for different food types

### Layer Types
- **Polygons**: Food/healthcare desert zones (GeoJsonLayer)
- **Points**: Individual facilities (ScatterplotLayer)
- **Heatmaps**: Density visualization (HeatmapLayer)

## 📦 Deployment

### Docker Build
```bash
docker build -t geospatial-dashboard:latest .
docker run -p 3000:3000 geospatial-dashboard:latest
```

### Vercel (Frontend Only)
```bash
cd frontend
vercel deploy
```

### Full Stack (Railway, Render, etc.)
See `docker-compose.yml` for containerization setup.

## 🧪 Testing

### Data Processing
```bash
python -m pytest data/tests/
```

### API Tests
```bash
cd frontend
npm run test
```

## 📚 Learning Resources

- [Deck.gl Documentation](https://deck.gl/)
- [PostGIS Manual](https://postgis.net/docs/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Web Mercator Projection](https://en.wikipedia.org/wiki/Web_Mercator_projection)
- [Geospatial Analysis in Python](https://www.oreilly.com/library/view/geopandas-for-geospatial-analysis/9781098048235/)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Commit changes (`git commit -m 'Add awesome feature'`)
4. Push to branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by projects highlighting social inequality
- Built with modern open-source geospatial tools
- Data sourced from public health and government databases

---

**Built with ❤️ to make spatial inequality visible.**
