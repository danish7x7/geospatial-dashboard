'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map as MapGL } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapStore } from '@/app/lib/store';
import {
  fetchFoodDeserts,
  fetchFoodAccess,
  fetchHealthcare,
  fetchDoubleBurden,
  getBoundsFromViewport,
} from '@/app/lib/geo';
import PinnedPopup, { PinnedPopupState } from './PinnedPopup';

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
  hospice_home_health: [20, 184, 166],  // teal — was [0,0,0] which is invisible on dark basemap
  other: [150, 150, 150],
};

// Food layer uses the purple-magenta-pink band to avoid collision with severity
// (reds/oranges/yellows) and healthcare (blues). Four distinct hues inside one
// family so a viewer with the legend can disambiguate at zoom-out.
const FOOD_TYPE_COLORS: Record<string, [number, number, number]> = {
  grocery_store: [236, 72, 153],   // hot pink — flagship (most common type)
  farmers_market: [168, 85, 247],  // violet
  food_pantry: [240, 171, 252],    // light pink/fuchsia
  community_garden: [124, 58, 237], // deep purple
};

// Double-burden overlay: pure white outline + semi-transparent white fill so
// the layer reads as "highlighted" on top of whatever's underneath. White is
// unused by the three primary categorical palettes (severity, healthcare, food).
const DOUBLE_BURDEN_FILL: [number, number, number, number] = [255, 255, 255, 50];
const DOUBLE_BURDEN_LINE: [number, number, number] = [255, 255, 255];

interface MapProps {
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Hover tooltip — single function dispatches by layer id. Returns a string
// (passed to DeckGL's getTooltip), or null when hovering off a feature.
// Kept terse: 1-3 fields max, just enough to know what's there.
// ---------------------------------------------------------------------------
function getTooltipContent(info: { object?: any; layer?: { id?: string } | null }) {
  if (!info.object) return null;
  const layerId = info.layer?.id;
  const props = info.object.properties ?? {};

  if (layerId === 'double-burden-zones') {
    return `Tract ${props.census_tract_id ?? ''}\nDouble burden: food + healthcare\nClick for details`;
  }
  if (layerId === 'food-desert-zones') {
    const sev = props.severity ? props.severity[0].toUpperCase() + props.severity.slice(1) : '—';
    return `Tract ${props.census_tract_id ?? ''}\nSeverity: ${sev}\nClick for details`;
  }
  if (layerId === 'food-access-points') {
    return `${props.name ?? 'Unknown'}\nClick for details`;
  }
  if (layerId === 'healthcare-facilities') {
    return `${props.name ?? 'Unknown'}\nClick for details`;
  }
  return null;
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
    setDoubleBurdenStats,
  } = useMapStore();

  // Pinned popup state. Null when nothing's pinned.
  const [popup, setPopup] = useState<PinnedPopupState | null>(null);
  const closePopup = useCallback(() => setPopup(null), []);

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

      // Double-burden is independent of the other filters. The API returns
      // features + regional totals + viewport totals in one call; we push
      // features into data slot and totals into the dedicated stats slot.
      // Always fetch totals even if layer is off, so the sidebar headline
      // is populated on page load — but skip the features fetch if the layer
      // isn't visible. Easy optimization: bounds=undefined when layer is off
      // skips the viewport query server-side too.
      const dbResult = await fetchDoubleBurden(layers.doubleBurden ? bounds : undefined);
      if (layers.doubleBurden) {
        setData('doubleBurden', dbResult.features);
      }
      setDoubleBurdenStats({
        regional: dbResult.totals,
        viewport: dbResult.viewport,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [viewState, width, height, layers, filters, setData, setLoading, setDoubleBurdenStats]);

  // Debounce data loading on view state change
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timeout);
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Click handlers — set the popup state. info.x / info.y are screen-relative
  // coordinates inside the DeckGL canvas, which is what PinnedPopup needs since
  // it renders absolute-positioned inside the same wrapping div.
  // Point layers (rendered on top of zones) get priority because Deck.gl's
  // picking returns the topmost pickable feature first. So a click on a
  // grocery dot fires the point layer's onClick, not the zone's.
  // ---------------------------------------------------------------------------
  const onClickTract = useCallback((info: any) => {
    if (!info.object) return;
    setPopup({
      content: { kind: 'tract', properties: info.object.properties ?? {} },
      x: info.x,
      y: info.y,
    });
  }, []);

  const onClickFoodPoint = useCallback((info: any) => {
    if (!info.object) return;
    setPopup({
      content: { kind: 'food_point', properties: info.object.properties ?? {} },
      x: info.x,
      y: info.y,
    });
  }, []);

  const onClickHealthcare = useCallback((info: any) => {
    if (!info.object) return;
    setPopup({
      content: { kind: 'healthcare', properties: info.object.properties ?? {} },
      x: info.x,
      y: info.y,
    });
  }, []);

  const onClickDoubleBurden = useCallback((info: any) => {
    if (!info.object) return;
    setPopup({
      content: { kind: 'double_burden', properties: info.object.properties ?? {} },
      x: info.x,
      y: info.y,
    });
  }, []);

  // Create deck.gl layers. Layer order matters for click priority:
  // food-desert zones (bottom), double-burden overlay (above zones, below
  // points), then points on top. Deck.gl's picker walks layers in reverse
  // so the last-pushed wins.
  const deckLayers: any[] = [];

  // Inferred 3D mode: any non-zero pitch means we're in the extruded view.
  // No separate state needed; the camera angle is the source of truth.
  const is3D = viewState.pitch > 0;

  // Elevation tuning: a tract with food_access_score = 0 extrudes to 20,000m,
  // a tract with score 80 extrudes to 4,000m. At zoom 10 over the Bay Area,
  // that puts the visual range roughly proportional to the lateral scale.
  // The score is 0-100; we invert it so higher towers = worse food access.
  // Tune HEIGHT_MULTIPLIER if it looks too tall/flat.
  const HEIGHT_MULTIPLIER = 20;

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
        // In 3D, sides need solid color so we bump opacity; in 2D the lighter
        // value lets the basemap show through for that "data overlay" feel.
        opacity: is3D ? 0.85 : 0.6,
        lineWidthMinPixels: 0.5,
        // Conditional extrusion. The same layer renders both flat and 3D —
        // Deck.gl handles re-render when extruded/getElevation change.
        extruded: is3D,
        getElevation: (feature: any) => {
          if (!is3D) return 0;
          const score = feature.properties?.food_access_score;
          if (score === null || score === undefined) return 0;
          // Invert: lower score = worse access = taller tower
          return Math.max(0, 100 - score) * HEIGHT_MULTIPLIER;
        },
        // Triggers Deck.gl to re-evaluate accessors when these change. Without
        // updateTriggers, toggling 3D wouldn't actually re-render the layer.
        updateTriggers: {
          getElevation: [is3D],
          opacity: [is3D],
        },
        onClick: onClickTract,
      })
    );
  }

  if (layers.doubleBurden && data.doubleBurden.length > 0) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'double-burden-zones',
        data: data.doubleBurden,
        // RGBA-with-alpha works in deck.gl when the 4th channel is set; we
        // use a semi-transparent white fill so the severity choropleth
        // underneath stays partially visible.
        getFillColor: DOUBLE_BURDEN_FILL,
        getLineColor: DOUBLE_BURDEN_LINE,
        getLineWidth: 3,
        lineWidthMinPixels: 2,
        pickable: true,
        onClick: onClickDoubleBurden,
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
        onClick: onClickFoodPoint,
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
        onClick: onClickHealthcare,
      })
    );
  }

  return (
    // Relative wrapper so PinnedPopup's `position: absolute` anchors here.
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
        getTooltip={getTooltipContent}
        // Empty-map click clears the pinned popup. Deck.gl fires this on every
        // click; if `info.object` exists, a layer's onClick handled it and set
        // the popup. If not, we're clicking empty map — dismiss.
        onClick={(info: any) => {
          if (!info.object) closePopup();
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <MapGL
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        />
      </DeckGL>
      <PinnedPopup state={popup} onClose={closePopup} />
    </div>
  );
}