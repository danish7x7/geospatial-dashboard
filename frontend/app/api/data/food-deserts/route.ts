import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/api/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity');
    const bounds = searchParams.get('bounds'); // bbox: minLng,minLat,maxLng,maxLat

    // LEFT JOIN census_tracts so click-popups can show demographic context
    // (population, poverty_rate, pct_without_vehicle, median_income) without a
    // second round-trip. Both tables have indexes on census_tract_id.
    let sql = `
      SELECT
        z.id,
        z.census_tract_id,
        ST_AsGeoJSON(z.geom) as geom,
        z.food_access_score,
        z.nearest_grocery_distance_m,
        z.num_food_access_points,
        z.population_affected,
        z.severity,
        t.population,
        t.poverty_rate,
        t.pct_without_vehicle,
        t.median_income,
        t.pct_snap
      FROM food_desert_zones z
      LEFT JOIN census_tracts t ON t.census_tract_id = z.census_tract_id
      WHERE TRUE
    `;

    const params: any[] = [];

    if (severity) {
      sql += ` AND z.severity = $${params.length + 1}`;
      params.push(severity);
    }

    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      sql += ` AND ST_Intersects(z.geom, ST_MakeEnvelope($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, 4326))`;
      params.push(minLng, minLat, maxLng, maxLat);
    }

    sql += ` LIMIT 2000`;

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
          // Demographics from census_tracts (joined). Nullable if the tract
          // row is missing demographic data; the popup handles undefined.
          population: row.population,
          poverty_rate: row.poverty_rate,
          pct_without_vehicle: row.pct_without_vehicle,
          median_income: row.median_income,
          pct_snap: row.pct_snap,
        },
        geometry: JSON.parse(row.geom),
      })),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch food desert zones' }, { status: 500 });
  }
}