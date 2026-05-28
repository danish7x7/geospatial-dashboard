import { create } from 'zustand';
import type { DoubleBurdenTotals } from './geo';

export interface MapState {
  viewState: {
    latitude: number;
    longitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
  };
  layers: {
    foodDeserts: boolean;
    foodAccess: boolean;
    healthcare: boolean;
    doubleBurden: boolean;
  };
  filters: {
    foodDesertSeverity: string | null;
    healthcareType: string | null;
    foodAccessType: string | null;
    acceptsMedicaid: boolean;
  };
  data: {
    foodDeserts: any[];
    foodAccess: any[];
    healthcare: any[];
    doubleBurden: any[];
    loading: boolean;
  };
  // Summary stats for the double-burden panel. Regional is the headline
  // ("X Bay Area tracts..."); viewport tracks the current viewport for the
  // live in-view counter. Loaded together by the same API call.
  doubleBurdenStats: {
    regional: DoubleBurdenTotals;
    viewport: DoubleBurdenTotals | null;
  };
}

interface MapStore extends MapState {
  setViewState: (state: Partial<MapState['viewState']>) => void;
  toggleLayer: (layer: keyof MapState['layers']) => void;
  setFilter: (filterKey: keyof MapState['filters'], value: any) => void;
  setData: (dataKey: keyof MapState['data'], data: any) => void;
  setLoading: (loading: boolean) => void;
  setDoubleBurdenStats: (stats: MapState['doubleBurdenStats']) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  viewState: {
    latitude: 37.7749, // San Francisco
    longitude: -122.4194,
    zoom: 10,
    bearing: 0,
    pitch: 0,
  },
  layers: {
    foodDeserts: true,
    foodAccess: true,
    healthcare: true,
    doubleBurden: false, // off by default — it's the analytical "extra" layer
  },
  filters: {
    foodDesertSeverity: null,
    healthcareType: null,
    foodAccessType: null,
    acceptsMedicaid: false,
  },
  data: {
    foodDeserts: [],
    foodAccess: [],
    healthcare: [],
    doubleBurden: [],
    loading: false,
  },
  doubleBurdenStats: {
    regional: { tract_count: 0, population_affected: 0 },
    viewport: null,
  },

  setViewState: (newState) =>
    set((state) => ({
      viewState: { ...state.viewState, ...newState },
    })),

  toggleLayer: (layer) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [layer]: !state.layers[layer],
      },
    })),

  setFilter: (filterKey, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [filterKey]: value,
      },
    })),

  setData: (dataKey, data) =>
    set((state) => ({
      data: {
        ...state.data,
        [dataKey]: data,
      },
    })),

  setLoading: (loading) =>
    set((state) => ({
      data: {
        ...state.data,
        loading,
      },
    })),

  setDoubleBurdenStats: (stats) =>
    set(() => ({
      doubleBurdenStats: stats,
    })),
}));