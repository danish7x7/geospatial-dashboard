'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map as MapGL } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapStore } from '@/app/lib/store';
import { fetchFoodDeserts, fetchFoodAccess, fetchHealthcare, getBoundsFromViewport } from '@/app/lib/geo';

// Initialize Mapbox with default token (fallback for demo)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  critical: [220, 20, 60],
  high: [255, 69, 0],
  medium: [255, 165, 0],
  low: [144, 238, 144],
};

const HEALTHCARE_TYPE_COLORS: Record<string, [number, number, number]> = {
  hospital: [0, 51, 204],
  clinic: [102, 178, 255],
  dialysis: [255, 102, 0],
  mental_health: [204, 102, 255],
  long_term_care: [255, 204, 0],
  hospice_home_health: [0, 0, 0],
  other: [150, 150, 150],
};

const FOOD_TYPE_COLORS: Record<string, [number, number, number]> = {
  grocery_store: [34, 139, 34],
  farmers_market: [60, 179, 113],
  food_pantry: [154, 205, 50],
  community_garden: [173, 255, 47],
};

interface MapProps {
  width?: number;
  height?: number;
}

export default function Map({ width = 800, height = 600 }: MapProps) {
  const {
    viewState,
    setViewState,
    layers,
    filters,
    data,
    setData,
    setLoading,
  } = useMapStore();

  // Fetch data based on view state
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const bounds = getBoundsFromViewport({ ...viewState, width, height });

      if (layers.foodDeserts) {
        const foodDeserts = await fetchFoodDeserts(bounds, filters.foodDesertSeverity || undefined);
        setData('foodDeserts', foodDeserts);
      }

      if (layers.foodAccess) {
        const foodAccess = await fetchFoodAccess(bounds, filters.foodAccessType || undefined);
        setData('foodAccess', foodAccess);
      }

      if (layers.healthcare) {
        const healthcare = await fetchHealthcare(bounds, filters.healthcareType || undefined, filters.acceptsMedicaid);
        setData('healthcare', healthcare);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [viewState, width, height, layers, filters, setData, setLoading]);

  // Debounce data loading on view state change
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timeout);
  }, [loadData]);

  // Create deck.gl layers
  const deckLayers: any[] = [];

  if (layers.foodDeserts && data.foodDeserts.length > 0) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'food-desert-zones',
        data: data.foodDeserts,
        getFillColor: (feature: any) => {
          const severity = feature.properties?.severity || 'low';
          return SEVERITY_COLORS[severity] || [128, 128, 128];
        },
        getLineColor: [0, 0, 0],
        getLineWidth: 1,
        pickable: true,
        opacity: 0.6,
        lineWidthMinPixels: 0.5,
        onHover: (info: any) => {
          if (info.object) {
            console.log('Hovered feature:', info.object.properties);
          }
        },
      })
    );
  }

  if (layers.foodAccess && data.foodAccess.length > 0) {
    deckLayers.push(
      new ScatterplotLayer({
        id: 'food-access-points',
        data: data.foodAccess,
        getPosition: (d: any) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
        getRadius: 80,
        getFillColor: (feature: any) => {
          const type = feature.properties?.type || 'grocery_store';
          return FOOD_TYPE_COLORS[type] || [0, 128, 255];
        },
        getLineColor: [255, 255, 255],
        getLineWidth: 1,
        pickable: true,
        radiusMinPixels: 3,
        radiusMaxPixels: 30,
      })
    );
  }

  if (layers.healthcare && data.healthcare.length > 0) {
    deckLayers.push(
      new ScatterplotLayer({
        id: 'healthcare-facilities',
        data: data.healthcare,
        getPosition: (d: any) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
        getRadius: 100,
        getFillColor: (feature: any) => {
          const type = feature.properties?.type || 'clinic';
          return HEALTHCARE_TYPE_COLORS[type] || [0, 100, 200];
        },
        getLineColor: [255, 255, 255],
        getLineWidth: 2,
        pickable: true,
        radiusMinPixels: 4,
        radiusMaxPixels: 40,
      })
    );
  }



  return (
    <DeckGL
      initialViewState={viewState}
      onViewStateChange={({ viewState: newViewState }: { viewState: any }) => {
        setViewState({
          latitude: newViewState.latitude,
          longitude: newViewState.longitude,
          zoom: newViewState.zoom,
          bearing: newViewState.bearing,
          pitch: newViewState.pitch,
        });
      }}
      controller={true}
      layers={deckLayers}
      style={{ width: '100%', height: '100%' }}
    >
      <MapGL
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      />
    </DeckGL>
  );
}
