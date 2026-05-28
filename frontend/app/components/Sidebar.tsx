'use client';

import React from 'react';
import { useMapStore } from '@/app/lib/store';
import { motion } from 'framer-motion';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: '🔴 Critical', color: '#dc143c' },
  { value: 'high', label: '🟠 High', color: '#ff4500' },
  { value: 'medium', label: '🟡 Medium', color: '#ffa500' },
  { value: 'low', label: '🟢 Low', color: '#90ee90' },
];

const HEALTHCARE_TYPES = [
  { value: 'hospital', label: '🏥 Hospital', color: '#0033cc' },
  { value: 'clinic', label: '⚕️ Clinic', color: '#66b2ff' },
  { value: 'dialysis', label: '🩸 Dialysis', color: '#ff6600' },
  { value: 'mental_health', label: '🧠 Mental Health', color: '#cc66ff' },
  { value: 'long_term_care', label: '🛏️ Long-Term Care', color: '#ffcc00' },
  { value: 'hospice_home_health', label: '🏠 Hospice / Home Health', color: '#14b8a6' },
];

const FOOD_TYPES = [
  { value: 'grocery_store', label: '🛒 Grocery Store', color: '#ec4899' },
  { value: 'farmers_market', label: '🌾 Farmers Market', color: '#a855f7' },
  { value: 'food_pantry', label: '📦 Food Pantry', color: '#f0abfc' },
  { value: 'community_garden', label: '🌱 Community Garden', color: '#7c3aed' },
];

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

export default function Sidebar() {
  const { layers, toggleLayer, filters, setFilter, data, doubleBurdenStats, viewState, setViewState } = useMapStore();

  // 3D mode inferred from pitch (matches Map.tsx). Toggle sets a moderate
  // pitch + slight bearing for a pleasant isometric-ish angle.
  const is3D = viewState.pitch > 0;
  const toggle3D = () => {
    if (is3D) {
      setViewState({ pitch: 0, bearing: 0 });
    } else {
      setViewState({ pitch: 45, bearing: -20 });
    }
  };

  return (
    <motion.div
      initial={{ x: -400 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      className="absolute left-0 top-0 h-full w-80 bg-slate-900 text-white shadow-2xl border-r border-slate-700 overflow-y-auto z-10"
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            🗺️ Spatial Inequality
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Food deserts & healthcare access analysis
          </p>
        </div>

        {/* Double-Burden Headline Stat — always visible. Bay Area-wide totals.
            This is the "interview talking point" stat: a single sentence
            summarizing the analytical insight from intersecting both layers. */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
            Double Burden
          </div>
          <div className="text-2xl font-bold text-white tabular-nums leading-tight">
            {fmtInt(doubleBurdenStats.regional.tract_count)}
            <span className="text-sm font-normal text-slate-400 ml-1">tracts</span>
          </div>
          <div className="text-xl font-semibold text-white tabular-nums leading-tight mt-1">
            {fmtInt(doubleBurdenStats.regional.population_affected)}
            <span className="text-sm font-normal text-slate-400 ml-1">people</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-snug">
            face <span className="text-white">both</span> a food desert{' '}
            <span className="text-white">and</span> a healthcare desert (high or
            critical severity on both).
          </p>
          {/* Live in-view counter — shown only when the layer is on, since
              that's when bbox is sent to the API and viewport totals exist. */}
          {layers.doubleBurden && doubleBurdenStats.viewport && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                In current view
              </div>
              <div className="text-sm tabular-nums text-slate-200">
                <span className="font-semibold">
                  {fmtInt(doubleBurdenStats.viewport.tract_count)}
                </span>{' '}
                tracts ·{' '}
                <span className="font-semibold">
                  {fmtInt(doubleBurdenStats.viewport.population_affected)}
                </span>{' '}
                people
              </div>
            </div>
          )}
        </div>

        {/* Layer Toggles */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">Layers</h2>
          <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-800 transition">
            <input
              type="checkbox"
              checked={layers.foodDeserts}
              onChange={() => toggleLayer('foodDeserts')}
              className="w-5 h-5 rounded accent-red-500"
            />
            <span>Food Deserts {data.foodDeserts.length > 0 && `(${data.foodDeserts.length})`}</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-800 transition">
            <input
              type="checkbox"
              checked={layers.foodAccess}
              onChange={() => toggleLayer('foodAccess')}
              className="w-5 h-5 rounded accent-green-500"
            />
            <span>Food Access Points {data.foodAccess.length > 0 && `(${data.foodAccess.length})`}</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-800 transition">
            <input
              type="checkbox"
              checked={layers.healthcare}
              onChange={() => toggleLayer('healthcare')}
              className="w-5 h-5 rounded accent-blue-500"
            />
            <span>Healthcare Facilities {data.healthcare.length > 0 && `(${data.healthcare.length})`}</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-800 transition">
            <input
              type="checkbox"
              checked={layers.doubleBurden}
              onChange={() => toggleLayer('doubleBurden')}
              className="w-5 h-5 rounded accent-white"
            />
            <span>
              Double-Burden Zones{' '}
              {data.doubleBurden.length > 0 && `(${data.doubleBurden.length})`}
            </span>
          </label>
        </div>

        {/* 3D toggle. Extrudes food-desert tracts by (100 - food_access_score):
            taller tower = worse food access. Only meaningful when the
            food-deserts layer is on; we still show the button regardless so
            it's discoverable, but hint the dependency. */}
        <div>
          <button
            onClick={toggle3D}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition ${
              is3D
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <span className="flex items-center space-x-2">
              <span className="text-lg">{is3D ? '🔲' : '⛰️'}</span>
              <span>{is3D ? '2D View' : '3D View'}</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {is3D ? 'flatten' : 'extrude'}
            </span>
          </button>
          {is3D && (
            <p className="text-[11px] text-slate-400 mt-2 leading-snug">
              Tract height = (100 − food access score). Taller towers indicate
              worse food access.
            </p>
          )}
        </div>

        {/* Food Desert Filters */}
        {layers.foodDeserts && (
          <div className="space-y-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-slate-200">Food Desert Severity</h3>
            <div className="space-y-2">
              <button
                onClick={() => setFilter('foodDesertSeverity', null)}
                className={`w-full text-left px-3 py-2 rounded transition ${
                  filters.foodDesertSeverity === null
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Severities
              </button>
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter('foodDesertSeverity', opt.value)}
                  className={`w-full text-left px-3 py-2 rounded transition flex items-center space-x-2 ${
                    filters.foodDesertSeverity === opt.value
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Healthcare Filters */}
        {layers.healthcare && (
          <div className="space-y-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-slate-200">Healthcare Type</h3>
            <div className="space-y-2">
              <button
                onClick={() => setFilter('healthcareType', null)}
                className={`w-full text-left px-3 py-2 rounded transition ${
                  filters.healthcareType === null
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Types
              </button>
              {HEALTHCARE_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter('healthcareType', opt.value)}
                  className={`w-full text-left px-3 py-2 rounded transition ${
                    filters.healthcareType === opt.value
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-slate-700 transition">
              <input
                type="checkbox"
                checked={filters.acceptsMedicaid}
                onChange={(e) => setFilter('acceptsMedicaid', e.target.checked)}
                className="w-4 h-4 rounded accent-green-500"
              />
              <span className="text-sm">Accepts Medicaid</span>
            </label>
          </div>
        )}

        {/* Food Access Filters */}
        {layers.foodAccess && (
          <div className="space-y-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-slate-200">Food Access Type</h3>
            <div className="space-y-2">
              <button
                onClick={() => setFilter('foodAccessType', null)}
                className={`w-full text-left px-3 py-2 rounded transition ${
                  filters.foodAccessType === null
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Types
              </button>
              {FOOD_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter('foodAccessType', opt.value)}
                  className={`w-full text-left px-3 py-2 rounded transition ${
                    filters.foodAccessType === opt.value
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="text-xs space-y-2 text-slate-300">
          <p className="font-semibold text-slate-200">Food Desert Severity</p>
          <p>🔴 Critical - low-income & low food access (USDA)</p>
          <p>🟠 High - low food access · 🟡 Medium - low-income · 🟢 Low</p>
          <p className="font-semibold text-slate-200 pt-2">Healthcare Facilities</p>
          <p>🏥 Hospital · ⚕️ Clinic · 🩸 Dialysis</p>
          <p>🧠 Mental health · 🛏️ Long-term care · 🏠 Hospice/home health</p>
          <p className="font-semibold text-slate-200 pt-2">Double Burden</p>
          <p>
            <span className="inline-block w-3 h-3 border-2 border-white align-middle mr-1" />
            White outline: high+critical on both food AND healthcare
          </p>
          <p className="text-slate-400 pt-1">Source: USDA Food Access Atlas 2019, CA HCAI/CDPH facility data, USDA SNAP Retailer Locator</p>
        </div>
      </div>
    </motion.div>
  );
}