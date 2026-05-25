import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/api/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity');
    const bounds = searchParams.get('bounds'); // bbox: minLng,minLat,maxLng,maxLat

    let sql = `
      SELECT 
        id,
        census_tract_id,
        ST_AsGeoJSON(geom) as geom,
        food_access_score,
        nearest_grocery_distance_m,
        num_food_access_points,
        population_affected,
        severity
      FROM food_desert_zones
      WHERE TRUE
    `;

    const params: any[] = [];

    if (severity) {
      sql += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }

    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      sql += ` AND ST_Intersects(geom, ST_MakeEnvelope($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, 4326))`;
      params.push(minLng, minLat, maxLng, maxLat);
    }

    sql += ` LIMIT 1000`;

    const rows = await query(sql, params);

    return NextResponse.json({
      type: 'FeatureCollection',
      features: rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        properties: {
          census_tract_id: row.census_tract_id,
          food_access_score: row.food_access_score,
          nearest_grocery_distance_m: row.nearest_grocery_distance_m,
          num_food_access_points: row.num_food_access_points,
          population_affected: row.population_affected,
          severity: row.severity,
        },
        geometry: JSON.parse(row.geom),
      })),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch food desert zones' }, { status: 500 });
  }
}
