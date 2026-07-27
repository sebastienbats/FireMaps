import React from 'react';
import './Alerts.css';

const Alerts = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <span className="alerts-icon">⚠️</span>
        <span className="alerts-title">Alertes de concentration</span>
      </div>
      <div className="alerts-list">
        {alerts.map((alert, index) => (
          <div key={index} className="alert-item">
            <span className="alert-icon">🔥</span>
            <span className="alert-text">
              {alert.count} feux dans un rayon de ~10 km
              <br />
              <span className="alert-coords">
                lat {alert.lat.toFixed(2)}, lon {alert.lng.toFixed(2)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
