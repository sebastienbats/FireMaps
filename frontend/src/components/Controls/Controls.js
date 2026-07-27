import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { PacmanLoader } from 'react-spinners';
import './Controls.css';

const Controls = ({
  sources,
  selectedSource,
  setSelectedSource,
  dayRange,
  setDayRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onFetch,
  onFilterChange,
  onExport,
  loading,
  showHeatmap,
  setShowHeatmap,
  showSdis,
  setShowSdis,
  darkMode
}) => {
  const [highConfidence, setHighConfidence] = useState(true);
  const [frp, setFrp] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('firms_map_key') || '');
  const [apiKeyStatus, setApiKeyStatus] = useState('');

  const handleFilterChange = () => {
    onFilterChange({ highConfidence, frp });
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('firms_map_key', apiKey.trim());
      setApiKeyStatus('✅ Clé sauvegardée');
      setTimeout(() => setApiKeyStatus(''), 3000);
    } else {
      localStorage.removeItem('firms_map_key');
      setApiKeyStatus('❌ Clé supprimée');
      setTimeout(() => setApiKeyStatus(''), 3000);
    }
  };

  useEffect(() => {
    // Mettre à jour la clé si elle change dans localStorage
    const handleStorageChange = () => {
      const newKey = localStorage.getItem('firms_map_key') || '';
      setApiKey(newKey);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="controls">
      <div className="control-group">
        <label className="control-label">
          <span className="icon">🔑</span> Clé API FIRMS
        </label>
        <div className="control-input-group">
          <input 
            type="password" 
            placeholder="Entrez votre MAP_KEY"
            className="api-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button className="btn-secondary" onClick={handleSaveApiKey}>
            💾
          </button>
        </div>
        {apiKeyStatus && (
          <div className={`api-status ${apiKeyStatus.includes('✅') ? 'success' : 'error'}`}>
            {apiKeyStatus}
          </div>
        )}
        <small className="control-help">
          Obtenez une clé sur <a href="https://firms.modaps.eosdis.nasa.gov/mapkey/" target="_blank" rel="noopener noreferrer">firms.modaps.eosdis.nasa.gov</a>
        </small>
        {apiKey && (
          <small className="control-help" style={{ color: '#27ae60' }}>
            ✅ Clé chargée ({apiKey.substring(0, 4)}...{apiKey.substring(apiKey.length - 4)})
          </small>
        )}
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="icon">🛰️</span> Source satellite
        </label>
        <Select
          options={sources}
          value={sources.find(s => s.value === selectedSource)}
          onChange={(option) => setSelectedSource(option.value)}
          className="react-select"
          classNamePrefix="react-select"
          theme={(theme) => ({
            ...theme,
            colors: {
              ...theme.colors,
              primary: '#e67e22',
              primary75: '#f39c12',
              primary50: '#f5b041',
              primary25: '#fdebd0',
            }
          })}
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="icon">📅</span> Période
        </label>
        <div className="control-row">
          <input 
            type="number" 
            value={dayRange} 
            onChange={(e) => setDayRange(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 5))}
            min="1" 
            max="5"
            className="input-small"
          />
          <span className="input-suffix">jours</span>
        </div>
        <div className="control-row">
          <label className="control-label-small">Du</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="input-date"
          />
          <label className="control-label-small">Au</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="input-date"
          />
        </div>
        <small className="control-help">Laissez vide pour la période glissante</small>
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="icon">🔍</span> Filtres
        </label>
        <div className="filter-group">
          <label className="filter-label">
            <input 
              type="checkbox" 
              checked={highConfidence} 
              onChange={(e) => {
                setHighConfidence(e.target.checked);
                setTimeout(handleFilterChange, 0);
              }}
            />
            Confiance élevée
          </label>
          <label className="filter-label">
            <input 
              type="checkbox" 
              checked={frp} 
              onChange={(e) => {
                setFrp(e.target.checked);
                setTimeout(handleFilterChange, 0);
              }}
            />
            FRP &gt; 50
          </label>
          <label className="filter-label">
            <input 
              type="checkbox" 
              checked={showHeatmap} 
              onChange={(e) => setShowHeatmap(e.target.checked)}
            />
            Heatmap
          </label>
          <label className="filter-label">
            <input 
              type="checkbox" 
              checked={showSdis} 
              onChange={(e) => setShowSdis(e.target.checked)}
            />
            SDIS
          </label>
        </div>
      </div>

      <div className="control-group">
        <button 
          className="btn-primary" 
          onClick={onFetch}
          disabled={loading || !apiKey}
        >
          {loading ? (
            <PacmanLoader size={20} color="white" />
          ) : (
            <>
              <span className="icon">🔄</span> Rafraîchir
            </>
          )}
        </button>
        {!apiKey && (
          <small className="control-help" style={{ color: '#e74c3c' }}>
            ⚠️ Veuillez entrer une clé API
          </small>
        )}
      </div>

      <div className="control-group">
        <label className="control-label">
          <span className="icon">📥</span> Exporter
        </label>
        <div className="export-group">
          <button className="btn-secondary" onClick={() => onExport('csv')} disabled={!apiKey}>
            📊 CSV
          </button>
          <button className="btn-secondary" onClick={() => onExport('geojson')} disabled={!apiKey}>
            🗺️ GeoJSON
          </button>
        </div>
      </div>
    </div>
  );
};

export default Controls;
