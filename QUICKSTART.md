# ⚡ Quick Start Guide

Get the geospatial dashboard running in under 10 minutes.

## Option 1: Docker (Recommended for Beginners)

```bash
# 1. Clone and navigate
git clone https://github.com/yourusername/geospatial-dashboard.git
cd geospatial-dashboard

# 2. Start services (PostgreSQL, Redis, pgAdmin)
docker-compose up -d

# 3. Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 10

# 4. Load sample data
python data/load_data.py

# 5. Install frontend dependencies
cd frontend
npm install

# 6. Add Mapbox token (get free token at https://account.mapbox.com)
echo 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here' > .env.local

# 7. Start development server
npm run dev
```

Visit **http://localhost:3000** and start exploring!

---

## Option 2: Native Installation (For Development)

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 16 + PostGIS 3.4
- Redis (optional, for caching)

### Setup

```bash
# 1. Install Node dependencies
cd frontend
npm install

# 2. Install Python dependencies
pip install psycopg2-binary geospatial

# 3. Create `.env.local` with Mapbox token
echo 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here' > .env.local

# 4. Configure PostgreSQL connection
# Edit frontend/.env.local with your database credentials:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=geospatial_db
# DB_USER=your_postgres_user
# DB_PASSWORD=your_postgres_password

# 5. Load sample data
python ../data/load_data.py

# 6. Start dev server
npm run dev
```

---

## Verifying Setup

### Check Database Connection
```bash
psql -h localhost -U geospatial_user -d geospatial_db -c "SELECT COUNT(*) FROM food_access_points;"
```

Expected output: `count` showing number of records (50+ for demo data)

### Check Frontend Build
```bash
cd frontend
npm run build
npm run type-check
```

Should complete without errors.

### Test API Endpoints
```bash
# Food deserts
curl 'http://localhost:3000/api/data/food-deserts'

# Healthcare facilities
curl 'http://localhost:3000/api/data/healthcare'

# Food access points
curl 'http://localhost:3000/api/data/food-access'
```

Should return valid GeoJSON.

---

## Troubleshooting

### PostgreSQL Connection Refused
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart if needed
docker-compose restart postgres
```

### Mapbox Token Error
- Get a free Mapbox token: https://account.mapbox.com/auth/signup
- Add to `.env.local`: `NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token`

### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000

# Or use a different port
PORT=3001 npm run dev
```

### Data Not Loading
```bash
# Reload data
docker-compose exec postgres psql -U geospatial_user -d geospatial_db
> DELETE FROM food_access_points;
> DELETE FROM healthcare_facilities;
> \q

python data/load_data.py
```

---

## Project Structure

```
geospatial-dashboard/
├── frontend/                    # Next.js 14 app
│   ├── app/
│   │   ├── components/         # React components
│   │   ├── api/                # Next.js API routes
│   │   ├── lib/                # Utilities & store
│   │   └── page.tsx            # Dashboard
│   └── package.json
├── data/
│   ├── load_data.py            # Data pipeline
│   └── README.md
├── scripts/
│   └── init.sql                # Database schema
├── docker-compose.yml          # Local development stack
├── README.md                   # Full documentation
└── QUICKSTART.md              # This file
```

---

## Next Steps

1. **Explore the Dashboard**
   - Pan and zoom the map
   - Toggle layers on/off
   - Filter by severity and type

2. **Understand the Data**
   - Check PostGIS queries in `frontend/app/api/`
   - Review data schema in `scripts/init.sql`
   - Examine synthetic data generation in `data/load_data.py`

3. **Customize**
   - Add your own geospatial data
   - Modify colors in `components/Map.tsx`
   - Create new analysis layers

4. **Deploy**
   - Frontend: `vercel deploy` (from `frontend/` directory)
   - Full stack: Docker to cloud provider

---

## Resources

- **Deck.gl**: https://deck.gl/docs
- **PostGIS**: https://postgis.net/docs/
- **Next.js**: https://nextjs.org/docs
- **Mapbox**: https://docs.mapbox.com/

---

**Questions?** Check README.md for detailed documentation or open an issue on GitHub.

Good luck! 🗺️✨
