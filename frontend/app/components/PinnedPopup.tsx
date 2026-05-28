'use client';

import React, { useEffect } from 'react';

/**
 * PinnedPopup
 *
 * Renders a click-pinned info card anchored to a screen position over the map.
 * One component, four content layouts (kind discriminator).
 *
 * Positioning: absolute, anchored above-and-right of the click point with a
 * small offset so the popup doesn't cover the clicked feature.
 *
 * Dismissal: X button, Escape key (handled here), or click on empty map
 * (handled by Map.tsx, which clears the popup state).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PopupKind = 'tract' | 'food_point' | 'healthcare' | 'double_burden';

export interface TractProps {
  census_tract_id?: string;
  severity?: string;
  food_access_score?: number;
  nearest_grocery_distance_m?: number;
  num_food_access_points?: number;
  population?: number;
  population_affected?: number;
  poverty_rate?: number;        // stored 0-1
  pct_without_vehicle?: number; // stored 0-1
  pct_snap?: number;            // stored 0-1
  median_income?: number;
}

export interface FoodPointProps {
  name?: string;
  type?: string;
  address?: string;
}

export interface HealthcareProps {
  name?: string;
  type?: string;
  address?: string;
  beds?: number;
  accepts_medicaid?: boolean;
}

export interface DoubleBurdenProps {
  census_tract_id?: string;
  food_severity?: string;
  healthcare_severity?: string;
  food_access_score?: number;
  nearest_grocery_distance_m?: number;
  num_food_access_points?: number;
  nearest_hospital_distance_m?: number;
  nearest_clinic_distance_m?: number;
  num_healthcare_facilities?: number;
  population?: number;
  poverty_rate?: number;
  pct_without_vehicle?: number;
  pct_snap?: number;
  median_income?: number;
}

type PopupContent =
  | { kind: 'tract'; properties: TractProps }
  | { kind: 'food_point'; properties: FoodPointProps }
  | { kind: 'healthcare'; properties: HealthcareProps }
  | { kind: 'double_burden'; properties: DoubleBurdenProps };

export interface PinnedPopupState {
  content: PopupContent;
  x: number; // screen px from map left
  y: number; // screen px from map top
}

interface PinnedPopupProps {
  state: PinnedPopupState | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtDistance(m?: number | null): string {
  if (m === null || m === undefined || Number.isNaN(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtPct(pct?: number | null): string {
  // Source values are already 0-100 (e.g. 5.10 means 5.10%, not 510%).
  // The USDA Atlas stores percentages this way; stage3's loader passes them
  // through unchanged. Earlier guess that they were 0-1 was wrong.
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—';
  return `${pct.toFixed(1)}%`;
}

function fmtInt(n?: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

function fmtMoney(n?: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `$${n.toLocaleString()}`;
}

function fmtScore(n?: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)} / 100`;
}

function prettyType(t?: string): string {
  if (!t) return '—';
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Severity → label + accent color (matches Map.tsx SEVERITY_COLORS)
const SEVERITY_STYLE: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#dc143c' },
  high: { label: 'High', color: '#ff4500' },
  medium: { label: 'Medium', color: '#ffa500' },
  low: { label: 'Low', color: '#90ee90' },
};

function SeverityPill({ severity }: { severity?: string }) {
  if (!severity) return <span className="text-slate-500">—</span>;
  const sev = SEVERITY_STYLE[severity];
  if (!sev) return <span className="text-slate-500">{severity}</span>;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-medium"
      style={{ backgroundColor: sev.color, color: '#0f172a' }}
    >
      {sev.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PinnedPopup({ state, onClose }: PinnedPopupProps) {
  // Escape-to-close. Effect re-binds when `state` toggles between null/non-null,
  // which is fine — handler is cheap.
  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, onClose]);

  if (!state) return null;

  // Offset the popup from the click so it doesn't cover the dot/feature.
  // Below-and-right anchor by default; flip if it would go off the viewport
  // (deferred to Map.tsx which has the viewport dims; here we trust the input).
  const style: React.CSSProperties = {
    position: 'absolute',
    left: state.x + 14,
    top: state.y + 14,
    zIndex: 20,
    minWidth: 240,
    maxWidth: 320,
    pointerEvents: 'auto',
  };

  return (
    <div
      style={style}
      className="bg-slate-900/95 backdrop-blur border border-slate-600 rounded-lg shadow-2xl text-white text-sm"
      onClick={(e) => e.stopPropagation()} // clicks inside popup don't dismiss
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white transition"
      >
        ×
      </button>
      <div className="p-4 pr-8">
        {state.content.kind === 'tract' && <TractBody p={state.content.properties} />}
        {state.content.kind === 'food_point' && <FoodPointBody p={state.content.properties} />}
        {state.content.kind === 'healthcare' && <HealthcareBody p={state.content.properties} />}
        {state.content.kind === 'double_burden' && <DoubleBurdenBody p={state.content.properties} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-kind bodies
// ---------------------------------------------------------------------------

function TractBody({ p }: { p: TractProps }) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-200">Census Tract</h3>
        <SeverityPill severity={p.severity} />
      </div>
      <div className="text-xs text-slate-400 mb-3 font-mono">{p.census_tract_id ?? '—'}</div>
      <Row label="Food access score" value={fmtScore(p.food_access_score)} />
      <Row label="Nearest grocery" value={fmtDistance(p.nearest_grocery_distance_m)} />
      <Row label="Grocery stores in tract" value={fmtInt(p.num_food_access_points)} />
      <hr className="my-2 border-slate-700" />
      <Row label="Population" value={fmtInt(p.population)} />
      <Row label="Population affected" value={fmtInt(p.population_affected)} />
      <Row label="Poverty rate" value={fmtPct(p.poverty_rate)} />
      <Row label="No vehicle" value={fmtPct(p.pct_without_vehicle)} />
      <Row label="SNAP households" value={fmtPct(p.pct_snap)} />
      <Row label="Median income" value={fmtMoney(p.median_income)} />
    </>
  );
}

function FoodPointBody({ p }: { p: FoodPointProps }) {
  return (
    <>
      <h3 className="font-semibold text-slate-200 mb-1">{p.name || 'Unknown'}</h3>
      <div className="text-xs text-pink-300 mb-3">{prettyType(p.type)}</div>
      {p.address && <div className="text-xs text-slate-400 leading-relaxed">{p.address}</div>}
    </>
  );
}

function HealthcareBody({ p }: { p: HealthcareProps }) {
  return (
    <>
      <h3 className="font-semibold text-slate-200 mb-1">{p.name || 'Unknown'}</h3>
      <div className="text-xs text-blue-300 mb-3">{prettyType(p.type)}</div>
      <Row label="Beds" value={p.beds != null ? fmtInt(p.beds) : '—'} />
      <Row
        label="Medi-Cal"
        value={
          p.accepts_medicaid === true
            ? 'Accepted'
            : p.accepts_medicaid === false
            ? 'Not accepted'
            : '—'
        }
      />
      {p.address && (
        <>
          <hr className="my-2 border-slate-700" />
          <div className="text-xs text-slate-400 leading-relaxed">{p.address}</div>
        </>
      )}
    </>
  );
}

function DoubleBurdenBody({ p }: { p: DoubleBurdenProps }) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-200">Double-Burden Tract</h3>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white text-slate-900 font-semibold">
          Both
        </span>
      </div>
      <div className="text-xs text-slate-400 mb-3 font-mono">{p.census_tract_id ?? '—'}</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-800 rounded p-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Food</div>
          <SeverityPill severity={p.food_severity} />
          <div className="text-xs text-slate-300 mt-2">
            {fmtDistance(p.nearest_grocery_distance_m)} to grocery
          </div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Healthcare</div>
          <SeverityPill severity={p.healthcare_severity} />
          <div className="text-xs text-slate-300 mt-2">
            {fmtDistance(p.nearest_hospital_distance_m)} to hospital
          </div>
        </div>
      </div>
      <Row label="Population" value={fmtInt(p.population)} />
      <Row label="Poverty rate" value={fmtPct(p.poverty_rate)} />
      <Row label="No vehicle" value={fmtPct(p.pct_without_vehicle)} />
      <Row label="Median income" value={fmtMoney(p.median_income)} />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-0.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 font-medium tabular-nums">{value}</span>
    </div>
  );
}