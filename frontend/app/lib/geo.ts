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
