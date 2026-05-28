import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/api/db';

/**
 * Double-burden zones: tracts classified as high-or-critical severity on BOTH
 * the food desert and healthcare desert axes. Strict AND across the two
 * existing severity classifications (no new thresholds invented here).
 *
 * Single round-trip returns:
 *   - features:    GeoJSON FeatureCollection (bbox-filtered if `bounds` given)
 *   - totals:      regional stats (count + population), NOT viewport-filtered
 *   - viewport:    viewport-specific stats if `bounds` given (else null)
 *
 * The regional totals are the headline interview stat ("X tracts, Y people");
 * viewport totals power the live "in this view" counter.
 */

const SEVERE_FOOD = ['high', 'critical'];
const SEVERE_CARE = ['high', 'critical'];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bounds = searchParams.get('bounds');

    // ---------------------------------------------------------------------
    // Regional totals — always computed, never bbox-filtered. The headline
    // stat: "X Bay Area tracts, Y people face both food AND healthcare deserts."
    // ---------------------------------------------------------------------
    const totalsSql = `
      SELECT
        COUNT(*)::int AS tract_count,
        COALESCE(SUM(t.population), 0)::int AS population_affected
      FROM food_desert_zones f
      JOIN healthcare_desert_zones h ON h.census_tract_id = f.census_tract_id
      JOIN census_tracts t ON t.census_tract_id = f.census_tract_id
      WHERE f.severity = ANY($1)
        AND h.severity = ANY($2)
    `;
    const totalsRows = await query(totalsSql, [SEVERE_FOOD, SEVERE_CARE]);
    const totals = totalsRows[0] ?? { tract_count: 0, population_affected: 0 };

    // ---------------------------------------------------------------------
    // Features — bbox-filtered if `bounds` given. Same JOIN, plus geometry +
    // the demographic fields needed for the click popup (mirrors the JOIN we
    // added to food-deserts in Task 2).
    // ---------------------------------------------------------------------
    const params: any[] = [SEVERE_FOOD, SEVERE_CARE];
    let featuresSql = `
      SELECT
        f.id,
        f.census_tract_id,
        ST_AsGeoJSON(f.geom) AS geom,
        f.food_access_score,
        f.nearest_grocery_distance_m,
        f.num_food_access_points,
        f.severity AS food_severity,
        h.severity AS healthcare_severity,
        h.nearest_hospital_distance_m,
        h.nearest_clinic_distance_m,
        h.num_healthcare_facilities,
        t.population,
        t.poverty_rate,
        t.pct_without_vehicle,
        t.median_income,
        t.pct_snap
      FROM food_desert_zones f
      JOIN healthcare_desert_zones h ON h.census_tract_id = f.census_tract_id
      JOIN census_tracts t ON t.census_tract_id = f.census_tract_id
      WHERE f.severity = ANY($1)
        AND h.severity = ANY($2)
    `;

    let viewportTotals: { tract_count: number; population_affected: number } | null = null;

    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      const envIdx = params.length;
      featuresSql += ` AND ST_Intersects(f.geom, ST_MakeEnvelope($${envIdx + 1}, $${envIdx + 2}, $${envIdx + 3}, $${envIdx + 4}, 4326))`;
      params.push(minLng, minLat, maxLng, maxLat);

      // Viewport totals: same WHERE, count + pop. Done as a second query for
      // clarity; could be combined via window functions but the cost is trivial.
      const viewportSql = `
        SELECT
          COUNT(*)::int AS tract_count,
          COALESCE(SUM(t.population), 0)::int AS population_affected
        FROM food_desert_zones f
        JOIN healthcare_desert_zones h ON h.census_tract_id = f.census_tract_id
        JOIN census_tracts t ON t.census_tract_id = f.census_tract_id
        WHERE f.severity = ANY($1)
          AND h.severity = ANY($2)
          AND ST_Intersects(f.geom, ST_MakeEnvelope($3, $4, $5, $6, 4326))
      `;
      const viewportRows = await query(viewportSql, [
        SEVERE_FOOD,
        SEVERE_CARE,
        minLng,
        minLat,
        maxLng,
        maxLat,
      ]);
      viewportTotals = viewportRows[0] ?? { tract_count: 0, population_affected: 0 };
    }

    featuresSql += ` LIMIT 2000`;

    const rows = await query(featuresSql, params);

    return NextResponse.json({
      type: 'FeatureCollection',
      features: rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        properties: {
          census_tract_id: row.census_tract_id,
          food_severity: row.food_severity,
          healthcare_severity: row.healthcare_severity,
          food_access_score: row.food_access_score,
          nearest_grocery_distance_m: row.nearest_grocery_distance_m,
          num_food_access_points: row.num_food_access_points,
          nearest_hospital_distance_m: row.nearest_hospital_distance_m,
          nearest_clinic_distance_m: row.nearest_clinic_distance_m,
          num_healthcare_facilities: row.num_healthcare_facilities,
          population: row.population,
          poverty_rate: row.poverty_rate,
          pct_without_vehicle: row.pct_without_vehicle,
          median_income: row.median_income,
          pct_snap: row.pct_snap,
        },
        geometry: JSON.parse(row.geom),
      })),
      totals: {
        tract_count: totals.tract_count,
        population_affected: totals.population_affected,
      },
      viewport: viewportTotals,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch double-burden zones' }, { status: 500 });
  }
}
