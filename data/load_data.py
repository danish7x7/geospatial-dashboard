#!/usr/bin/env python3
"""
Geospatial Data Processing Pipeline
Fetches and processes food access and healthcare facility data
"""

import json
import random
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
import sys

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'geospatial_db',
    'user': 'geospatial_user',
    'password': 'geospatial_pass'
}

# Sample US Cities for demonstration (lat, lng, name)
SAMPLE_AREAS = [
    {'lat': 37.7749, 'lng': -122.4194, 'name': 'San Francisco, CA', 'state': 'CA'},
    {'lat': 34.0522, 'lng': -118.2437, 'name': 'Los Angeles, CA', 'state': 'CA'},
    {'lat': 40.7128, 'lng': -74.0060, 'name': 'New York, NY', 'state': 'NY'},
    {'lat': 41.8781, 'lng': -87.6298, 'name': 'Chicago, IL', 'state': 'IL'},
    {'lat': 29.7604, 'lng': -95.3698, 'name': 'Houston, TX', 'state': 'TX'},
]

FOOD_TYPES = ['grocery_store', 'farmers_market', 'food_pantry', 'community_garden']
HEALTHCARE_TYPES = ['hospital', 'clinic', 'urgent_care', 'dental', 'mental_health']

def generate_synthetic_data(center_lat, center_lng, area_name, num_points=50):
    """
    Generate synthetic food access and healthcare facility data
    within a radius of a city center
    """
    food_points = []
    healthcare_points = []
    
    # Generate food access points
    for i in range(num_points):
        # Random offset within ~0.1 degrees (roughly 11km)
        lat = center_lat + random.uniform(-0.1, 0.1)
        lng = center_lng + random.uniform(-0.1, 0.1)
        
        food_points.append({
            'name': f"{random.choice(['Green', 'Fresh', 'Local', 'Community'])} {random.choice(['Market', 'Pantry', 'Store'])} - {area_name}",
            'type': random.choice(FOOD_TYPES),
            'latitude': lat,
            'longitude': lng,
            'address': f"{random.randint(100, 9999)} Main St, {area_name}",
            'census_tract': f"{random.randint(1000, 9999)}"
        })
    
    # Generate healthcare facilities
    for i in range(num_points // 2):
        lat = center_lat + random.uniform(-0.1, 0.1)
        lng = center_lng + random.uniform(-0.1, 0.1)
        
        healthcare_points.append({
            'name': f"{random.choice(['St.', 'Central', 'City', 'County'])} {random.choice(['Hospital', 'Clinic', 'Medical Center'])} - {area_name}",
            'type': random.choice(HEALTHCARE_TYPES),
            'latitude': lat,
            'longitude': lng,
            'address': f"{random.randint(100, 9999)} Healthcare Ave, {area_name}",
            'census_tract': f"{random.randint(1000, 9999)}",
            'beds': random.randint(10, 500) if random.random() > 0.5 else None,
            'accepts_medicaid': random.choice([True, False])
        })
    
    return food_points, healthcare_points

def connect_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def load_food_access_data(conn, food_points):
    """Insert food access points into database"""
    cursor = conn.cursor()
    
    try:
        insert_query = """
        INSERT INTO food_access_points 
        (name, type, latitude, longitude, geom, address, census_tract)
        VALUES %s
        """
        
        values = [
            (
                point['name'],
                point['type'],
                point['latitude'],
                point['longitude'],
                f"POINT({point['longitude']} {point['latitude']})",
                point['address'],
                point['census_tract']
            )
            for point in food_points
        ]
        
        execute_values(cursor, insert_query, values)
        conn.commit()
        print(f"✓ Loaded {len(food_points)} food access points")
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Error loading food access data: {e}")

def load_healthcare_data(conn, healthcare_points):
    """Insert healthcare facilities into database"""
    cursor = conn.cursor()
    
    try:
        insert_query = """
        INSERT INTO healthcare_facilities 
        (name, type, latitude, longitude, geom, address, census_tract, beds, accepts_medicaid)
        VALUES %s
        """
        
        values = [
            (
                point['name'],
                point['type'],
                point['latitude'],
                point['longitude'],
                f"POINT({point['longitude']} {point['latitude']})",
                point['address'],
                point['census_tract'],
                point.get('beds'),
                point.get('accepts_medicaid', False)
            )
            for point in healthcare_points
        ]
        
        execute_values(cursor, insert_query, values)
        conn.commit()
        print(f"✓ Loaded {len(healthcare_points)} healthcare facilities")
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Error loading healthcare data: {e}")

def create_food_desert_zones(conn):
    """Create food desert zones based on clustering and distance analysis"""
    cursor = conn.cursor()
    
    try:
        # This would normally use complex spatial analysis
        # For now, we'll create a simplified version
        cursor.execute("""
        WITH food_stats AS (
            SELECT 
                ct.census_tract_id,
                ct.geom,
                ct.population,
                COUNT(fa.id) as food_count,
                MIN(ST_Distance(ct.geom::geography, fa.geom::geography)) as nearest_distance
            FROM census_tracts ct
            LEFT JOIN food_access_points fa ON ST_DWithin(ct.geom::geography, fa.geom::geography, 5000)
            GROUP BY ct.census_tract_id, ct.geom, ct.population
        )
        INSERT INTO food_desert_zones 
        (census_tract_id, geom, food_access_score, nearest_grocery_distance_m, 
         num_food_access_points, population_affected, severity)
        SELECT
            fs.census_tract_id,
            fs.geom,
            LEAST(100, GREATEST(0, 100 - (COALESCE(fs.nearest_distance, 5000) / 50)::int)) as food_access_score,
            COALESCE(fs.nearest_distance, 5000),
            COALESCE(fs.food_count, 0),
            fs.population,
            CASE 
                WHEN COALESCE(fs.nearest_distance, 5000) > 3000 THEN 'critical'
                WHEN COALESCE(fs.nearest_distance, 5000) > 2000 THEN 'high'
                WHEN COALESCE(fs.nearest_distance, 5000) > 1000 THEN 'medium'
                ELSE 'low'
            END
        FROM food_stats fs
        ON CONFLICT (census_tract_id) DO NOTHING
        """)
        conn.commit()
        print("✓ Created food desert zones")
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Error creating food desert zones: {e}")

def main():
    """Main data pipeline"""
    print("🌍 Geospatial Data Processing Pipeline")
    print("=" * 50)
    
    # Connect to database
    conn = connect_db()
    print("✓ Connected to PostgreSQL")
    
    # Generate and load data for sample cities
    for area in SAMPLE_AREAS:
        print(f"\n📍 Processing {area['name']}...")
        food_points, healthcare_points = generate_synthetic_data(
            area['lat'], 
            area['lng'], 
            area['name'],
            num_points=50
        )
        
        load_food_access_data(conn, food_points)
        load_healthcare_data(conn, healthcare_points)
    
    # Create derived zones
    print("\n🗺️  Creating spatial analysis zones...")
    create_food_desert_zones(conn)
    
    # Summary statistics
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM food_access_points")
    food_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM healthcare_facilities")
    health_count = cursor.fetchone()[0]
    
    print("\n" + "=" * 50)
    print("📊 Data Loading Summary:")
    print(f"   Food Access Points: {food_count}")
    print(f"   Healthcare Facilities: {health_count}")
    print("=" * 50)
    
    conn.close()
    print("\n✅ Data pipeline complete!")

if __name__ == '__main__':
    main()
