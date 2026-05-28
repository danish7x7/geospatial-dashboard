import axios from 'axios';
import { WebMercatorViewport } from '@deck.gl/core';

export interface ViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  width: number;
  height: number;
}

export function getBoundsFromViewport(viewState: ViewState): [number, number, number, number] {
  const viewport = new WebMercatorViewport({
    width: viewState.width,
    height: viewState.height,
    longitude: viewState.longitude,
    latitude: viewState.latitude,
    zoom: viewState.zoom,
  });

  return viewport.getBounds();
}
/**
 * Fetch food desert zones
 */
export async function fetchFoodDeserts(bounds?: [number, number, number, number], severity?: string) {
  try {
    const params = new URLSearchParams();
    if (bounds) {
      params.append('bounds', bounds.join(','));
    }
    if (severity) {
      params.append('severity', severity);
    }

    const response = await axios.get(`/api/data/food-deserts?${params.toString()}`);
    return response.data.features;
  } catch (error) {
    console.error('Error fetching food deserts:', error);
    return [];
  }
}

/**
 * Fetch food access points (grocery, farmers market, etc.)
 */
export async function fetchFoodAccess(bounds?: [number, number, number, number], type?: string) {
  try {
    const params = new URLSearchParams();
    if (bounds) {
      params.append('bounds', bounds.join(','));
    }
    if (type) {
      params.append('type', type);
    }

    const response = await axios.get(`/api/data/food-access?${params.toString()}`);
    return response.data.features;
  } catch (error) {
    console.error('Error fetching food access:', error);
    return [];
  }
}

/**
 * Fetch healthcare facilities
 */
export async function fetchHealthcare(
  bounds?: [number, number, number, number],
  type?: string,
  acceptsMedicaid?: boolean
) {
  try {
    const params = new URLSearchParams();
    if (bounds) {
      params.append('bounds', bounds.join(','));
    }
    if (type) {
      params.append('type', type);
    }
    if (acceptsMedicaid) {
      params.append('accepts_medicaid', 'true');
    }

    const response = await axios.get(`/api/data/healthcare?${params.toString()}`);
    return response.data.features;
  } catch (error) {
    console.error('Error fetching healthcare:', error);
    return [];
  }
}

/**
 * Fetch double-burden zones (tracts that are high+critical food deserts AND
 * high+critical healthcare deserts). Returns features + regional totals +
 * viewport totals in a single round-trip.
 *
 * Distinct shape from the other helpers: those return just `features` (an
 * array); this returns an object so callers get the summary stats too.
 */
export interface DoubleBurdenTotals {
  tract_count: number;
  population_affected: number;
}

export interface DoubleBurdenResult {
  features: any[];
  totals: DoubleBurdenTotals;
  viewport: DoubleBurdenTotals | null;
}

export async function fetchDoubleBurden(
  bounds?: [number, number, number, number]
): Promise<DoubleBurdenResult> {
  try {
    const params = new URLSearchParams();
    if (bounds) {
      params.append('bounds', bounds.join(','));
    }

    const response = await axios.get(`/api/data/double-burden?${params.toString()}`);
    return {
      features: response.data.features ?? [],
      totals: response.data.totals ?? { tract_count: 0, population_affected: 0 },
      viewport: response.data.viewport ?? null,
    };
  } catch (error) {
    console.error('Error fetching double-burden zones:', error);
    return {
      features: [],
      totals: { tract_count: 0, population_affected: 0 },
      viewport: null,
    };
  }
}