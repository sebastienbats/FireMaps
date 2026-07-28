import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { PacmanLoader } from 'react-spinners';
import './Controls.css';

// Liste des couches WMS disponibles
const WMS_LAYERS = [
  // --- Open-Meteo (tuiles météo) ---
  { value: 'temperature_2m', label: '🌡️ Température', type: 'open-meteo' },
  { value: 'precipitation', label: '🌧️ Précipitations', type: 'open-meteo' },
  { value: 'cloudcover', label: '☁️ Couverture nuageuse', type: 'open-meteo' },
  { value: 'pressure_msl', label: '📊 Pression', type: 'open-meteo' },
  { value: 'wind_speed_10m', label: '💨 Vitesse du vent', type: 'open-meteo' },
  { value: 'relative_humidity_2m', label: '💧 Humidité', type: 'open-meteo' },
  // --- NASA GIBS (WMS) ---
  { value: 'ndvi', label: '🌿 Végétation (NDVI)', type: 'gibs', layer: 'MOD13A2_NDVI' },
  { value: 'lst_day', label: '🌡️ LST (jour)', type: 'gibs', layer: 'MOD11A1_LST_Day_1km' },
  { value: 'lst_night', label: '🌡️ LST (nuit)', type: 'gibs', layer: 'MOD11A1_LST_Night_1km' },
];

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
  showWind,
  setShowWind,
  windLoading,
  darkMode,
  wmsLayer,
  setWmsLayer,
  wmsOpacity,
  setWmsOpacity,
}) => {
  const [highConfidence, setHighConfidence] = useState(true);
  const [frp, setFrp] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('firms_map_key') || '');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [isKeyValid, setIsKeyValid] = useState(false);

  const handleFilterChange = () => {
    onFilterChange({ highConfidence, frp });
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      if (trimmed.length < 32) {
        setApiKeyStatus('⚠️ Clé trop courte (32 caractères min.)');
        setIsKeyValid(false);
        setTimeout(() => setApiKeyStatus(''), 4000);
        return;
      }
      localStorage.setItem('firms_map_key', trimmed);
      setIsKeyValid(true);
      setApiKeyStatus('✅ Clé sauvegardée');
      setTimeout(() => setApiKeyStatus(''), 3000);
    } else {
      localStorage.removeItem('firms_map_key');
      setIsKeyValid(false);
      setApiKeyStatus('❌ Clé supprimée');
      setTimeout(() => setApiKeyStatus(''), 3000);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('firms_map_key');
    if (saved && saved.length >= 32) setIsKeyValid(true);
  }, []);

  return (
    <div className="controls">
      {/* Clé API */}
      <div className="control-group">
        <label className="control-label"><span className="icon">🔑</span> Clé API FIRMS</label>
        <div className="control-input-group">
          <input
            type="password"
            placeholder="MAP_KEY (32 caractères)"
            className="api-input"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setIsKeyValid(false); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button className="btn-secondary" onClick={handleSaveApiKey}>💾</button>
        </div>
        {apiKeyStatus && (
          <div className={`api-status ${apiKeyStatus.includes('✅') ? 'success' : apiKeyStatus.includes('⚠️') ? 'warning' : 'error'}`}>
            {apiKeyStatus}
          </div>
        )}
        <small className="control-help">
          Obtenez une clé sur <a href="https://firms.modaps.eosdis.nasa.gov/mapkey/" target="_blank" rel="noopener noreferrer">firms.modaps.eosdis.nasa.gov</a>
        </small>
        {apiKey && (
          <small className="control-help" style={{ color: isKeyValid ? '#27ae60' : '#f39c12' }}>
            {isKeyValid ? `✅ Valide (${apiKey.length} caractères)` : '⚠️ Non sauvegardée'}
          </small>
        )}
      </div>

      {/* Source satellite */}
      <div className="control-group">
        <label className="control-label"><span className="icon">🛰️</span> Source satellite</label>
        <Select
          options={sources}
          value={sources.find(s => s.value === selectedSource)}
          onChange={(opt) => setSelectedSource(opt.value)}
          className="react-select"
          classNamePrefix="react-select"
          isDisabled={loading}
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

      {/* Période */}
      <div className="control-group">
        <label className="control-label"><span className="icon">📅</span> Période</label>
        <div className="control-row">
          <input
            type="number"
            value={dayRange}
            onChange={(e) => setDayRange(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 5))}
            min="1"
            max="5"
            className="input-small"
            disabled={loading}
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
            disabled={loading}
          />
          <label className="control-label-small">Au</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-date"
            disabled={loading}
          />
        </div>
        <small className="control-help">Laissez vide pour la période glissante</small>
      </div>

      {/* Filtres */}
      <div className="control-group">
        <label className="control-label"><span className="icon">🔍</span> Filtres</label>
        <div className="filter-group">
          <label className="filter-label">
            <input
              type="checkbox"
              checked={highConfidence}
              onChange={(e) => {
                setHighConfidence(e.target.checked);
                setTimeout(handleFilterChange, 0);
              }}
              disabled={loading}
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
              disabled={loading}
            />
            FRP &gt; 50
          </label>
          <label className="filter-label">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              disabled={loading}
            />
            Heatmap
          </label>
          <label className="filter-label">
            <input
              type="checkbox"
              checked={showSdis}
              onChange={(e) => setShowSdis(e.target.checked)}
              disabled={loading}
            />
            SDIS
          </label>
          <label className="filter-label">
            <input
              type="checkbox"
              checked={showWind}
              onChange={(e) => setShowWind(e.target.checked)}
              disabled={loading || windLoading}
            />
            Vent {windLoading && <span className="spinner-small">🌀</span>}
          </label>
        </div>
      </div>

      {/* Couches WMS */}
      <div className="control-group">
        <label className="control-label"><span className="icon">🗺️</span> Couche WMS</label>
        <Select
          options={WMS_LAYERS}
          value={WMS_LAYERS.find(l => l.value === wmsLayer)}
          onChange={(opt) => setWmsLayer(opt ? opt.value : null)}
          placeholder="Aucune couche"
          isClearable
          className="react-select"
          classNamePrefix="react-select"
          isDisabled={loading}
          theme={(theme) => ({
            ...theme,
            colors: {
              ...theme.colors,
              primary: '#2e86de',
              primary75: '#54a0ff',
              primary50: '#7fbfff',
              primary25: '#d6eaf8',
            }
          })}
        />
        {wmsLayer && (
          <div className="control-row" style={{ marginTop: '4px' }}>
            <label className="control-label-small">Opacité</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={wmsOpacity}
              onChange={(e) => setWmsOpacity(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.7rem', minWidth: '30px' }}>
              {Math.round(wmsOpacity * 100)}%
            </span>
          </div>
        )}
        <small className="control-help">
          {wmsLayer && WMS_LAYERS.find(l => l.value === wmsLayer)?.type === 'gibs'
            ? 'Données NASA GIBS • MODIS'
            : 'Données Open‑Meteo • Mise à jour horaire'}
        </small>
      </div>

      {/* Rafraîchir */}
      <div className="control-group">
        <button className="btn-primary" onClick={onFetch} disabled={loading || !isKeyValid}>
          {loading ? <PacmanLoader size={20} color="white" /> : <><span className="icon">🔄</span> Rafraîchir</>}
        </button>
        {!isKeyValid && (
          <small className="control-help" style={{ color: '#e74c3c' }}>
            ⚠️ Entrez et sauvegardez votre clé API (💾)
          </small>
        )}
        {isKeyValid && !loading && (
          <small className="control-help" style={{ color: '#27ae60' }}>✅ Prêt</small>
        )}
      </div>

      {/* Export */}
      <div className="control-group">
        <label className="control-label"><span className="icon">📥</span> Exporter</label>
        <div className="export-group">
          <button
            className="btn-secondary"
            onClick={() => onExport('csv')}
            disabled={!isKeyValid || loading}
          >
            📊 CSV
          </button>
          <button
            className="btn-secondary"
            onClick={() => onExport('geojson')}
            disabled={!isKeyValid || loading}
          >
            🗺️ GeoJSON
          </button>
        </div>
        <small className="control-help">Exporte les données filtrées affichées</small>
      </div>
    </div>
  );
};

export default Controls;
