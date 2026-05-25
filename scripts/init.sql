-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Food Access Points (grocery stores, farmers markets, etc.)
CREATE TABLE IF NOT EXISTS food_access_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'grocery_store', 'farmers_market', 'food_pantry'
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    address VARCHAR(255),
    census_tract VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Healthcare Facilities (hospitals, clinics, etc.)
CREATE TABLE IF NOT EXISTS healthcare_facilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'hospital', 'clinic', 'urgent_care', 'dental'
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    address VARCHAR(255),
    census_tract VARCHAR(20),
    beds INTEGER,
    accepts_medicaid BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Census Tracts (for aggregation and demographic analysis)
CREATE TABLE IF NOT EXISTS census_tracts (
    id SERIAL PRIMARY KEY,
    census_tract_id VARCHAR(20) UNIQUE NOT NULL,
    state_fips VARCHAR(2),
    county_fips VARCHAR(3),
    tract_fips VARCHAR(6),
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    population INTEGER,
    median_income INTEGER,
    poverty_rate FLOAT,
    pct_without_vehicle FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Food Desert Areas (derived/aggregated)
CREATE TABLE IF NOT EXISTS food_desert_zones (
    id SERIAL PRIMARY KEY,
    census_tract_id VARCHAR(20) UNIQUE NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    food_access_score FLOAT, -- 0-100, lower = worse food access
    nearest_grocery_distance_m FLOAT, -- distance in meters to nearest grocery
    num_food_access_points INTEGER,
    population_affected INTEGER,
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Healthcare Desert Zones (derived/aggregated)
CREATE TABLE IF NOT EXISTS healthcare_desert_zones (
    id SERIAL PRIMARY KEY,
    census_tract_id VARCHAR(20) UNIQUE NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    healthcare_access_score FLOAT, -- 0-100, lower = worse healthcare access
    nearest_hospital_distance_m FLOAT,
    nearest_clinic_distance_m FLOAT,
    num_healthcare_facilities INTEGER,
    population_affected INTEGER,
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial indexes for fast queries
CREATE INDEX idx_food_access_geom ON food_access_points USING GIST(geom);
CREATE INDEX idx_healthcare_geom ON healthcare_facilities USING GIST(geom);
CREATE INDEX idx_census_tracts_geom ON census_tracts USING GIST(geom);
CREATE INDEX idx_food_desert_geom ON food_desert_zones USING GIST(geom);
CREATE INDEX idx_healthcare_desert_geom ON healthcare_desert_zones USING GIST(geom);

-- Create indexes on common query columns
CREATE INDEX idx_food_access_type ON food_access_points(type);
CREATE INDEX idx_healthcare_type ON healthcare_facilities(type);
CREATE INDEX idx_census_tract_id ON census_tracts(census_tract_id);
CREATE INDEX idx_food_desert_severity ON food_desert_zones(severity);
CREATE INDEX idx_healthcare_desert_severity ON healthcare_desert_zones(severity);

-- Grant permissions to geospatial_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO geospatial_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO geospatial_user;
