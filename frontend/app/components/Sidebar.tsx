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
  { value: 'hospice_home_health', label: '🏠 Hospice / Home Health', color: '#66cc99' },
];

const FOOD_TYPES = [
  { value: 'grocery_store', label: '🛒 Grocery Store', color: '#228b22' },
  { value: 'farmers_market', label: '🌾 Farmers Market', color: '#3cb371' },
  { value: 'food_pantry', label: '📦 Food Pantry', color: '#9acd32' },
  { value: 'community_garden', label: '🌱 Community Garden', color: '#adff2f' },
];

export default function Sidebar() {
  const { layers, toggleLayer, filters, setFilter, data } = useMapStore();

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
          <p>🔴 Critical — low-income & low food access (USDA)</p>
          <p>🟠 High — low food access · 🟡 Medium — low-income · 🟢 Low</p>
          <p className="font-semibold text-slate-200 pt-2">Healthcare Facilities</p>
          <p>🏥 Hospital · ⚕️ Clinic · 🩸 Dialysis</p>
          <p>🧠 Mental health · 🛏️ Long-term care · 🏠 Hospice/home health</p>
          <p className="text-slate-400 pt-1">Source: USDA Food Access Atlas 2019, CA HCAI/CDPH facility data</p>
        </div>
      </div>
    </motion.div>
  );
}
