import React from 'react';
import { METRIC_FIELDS } from './constants';

export default function MetricsPanel({ metrics, onUpdateMetric }) {
  return (
    <div className="mt-4">
      <div className="metrics-heading">
        <label className="form-label">Chỉ số nhanh</label>
        <span>1 thấp • 5 cao</span>
      </div>
      <div className="metrics-grid">
        {METRIC_FIELDS.map(field => (
          <div key={field.id} className="metric-slider">
            <div className="metric-slider-head">
              <strong>{field.label}</strong>
              <span>{metrics[field.id]}/5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={metrics[field.id]}
              onChange={e => onUpdateMetric(field.id, e.target.value)}
              aria-label={`${field.label} ${metrics[field.id]} trên 5`}
            />
            <div className="metric-slider-scale">
              <small>{field.low}</small>
              <small>{field.high}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
