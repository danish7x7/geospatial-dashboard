import { create } from 'zustand';

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
    loading: boolean;
  };
}

interface MapStore extends MapState {
  setViewState: (state: Partial<MapState['viewState']>) => void;
  toggleLayer: (layer: keyof MapState['layers']) => void;
  setFilter: (filterKey: keyof MapState['filters'], value: any) => void;
  setData: (dataKey: keyof MapState['data'], data: any) => void;
  setLoading: (loading: boolean) => void;
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
    loading: false,
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
}));
