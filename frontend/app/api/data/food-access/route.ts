import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/api/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const bounds = searchParams.get('bounds');

    let sql = `
      SELECT 
        id,
        name,
        type,
        latitude,
        longitude,
        ST_AsGeoJSON(geom) as geom,
        address
      FROM food_access_points
      WHERE TRUE
    `;

    const params: any[] = [];

    if (type) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      sql += ` AND ST_Intersects(geom, ST_MakeEnvelope($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, 4326))`;
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
          name: row.name,
          type: row.type,
          address: row.address,
        },
        geometry: JSON.parse(row.geom),
      })),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch food access points' }, { status: 500 });
  }
}
