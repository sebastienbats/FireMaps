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
  showWind = false,
  setShowWind,
  windLoading = false,
  darkMode
}) => {
  const [highConfidence, setHighConfidence] = useState(true);
  const [frp, setFrp] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('firms_map_key') || '');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [isKeyValid, setIsKeyValid] = useState(false);

  // Gérer le changement des filtres
  const handleFilterChange = () => {
    onFilterChange({ highConfidence, frp });
  };

  // Sauvegarder la clé API
  const handleSaveApiKey = () => {
    const trimmedKey = apiKey.trim();
    if (trimmedKey) {
      if (trimmedKey.length < 32) {
        setApiKeyStatus('⚠️ La clé semble trop courte (minimum 32 caractères)');
        setIsKeyValid(false);
        setTimeout(() => setApiKeyStatus(''), 4000);
        return;
      }
      
      localStorage.setItem('firms_map_key', trimmedKey);
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

  // Vérifier la clé au chargement
  useEffect(() => {
    const savedKey = localStorage.getItem('firms_map_key');
    if (savedKey && savedKey.trim() && savedKey.trim().length >= 32) {
      setIsKeyValid(true);
    }
  }, []);

  // Synchroniser l'état de la clé avec le localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newKey = localStorage.getItem('firms_map_key') || '';
      setApiKey(newKey);
      setIsKeyValid(newKey.length >= 32);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="controls">
      {/* ============================================================
          CLAÉ API FIRMS
          ============================================================ */}
      <div className="control-group">
        <label className="control-label">
          <span className="icon">🔑</span> Clé API FIRMS
        </label>
        <div className="control-input-group">
          <input 
            type="password" 
            placeholder="Entrez votre MAP_KEY (32 caractères)"
            className="api-input"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsKeyValid(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button className="btn-secondary" onClick={handleSaveApiKey}>
            💾
          </button>
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
            {isKeyValid ? `✅ Clé valide (${apiKey.length} caractères)` : '⚠️ Clé non sauvegardée'}
          </small>
        )}
      </div>

      {/* ============================================================
          SOURCE SATELLITE
          ============================================================ */}
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

      {/* ============================================================
          PÉRIODE
          ============================================================ */}
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

      {/* ============================================================
          FILTRES
          ============================================================ */}
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

      {/* ============================================================
          BOUTON RAFRAÎCHIR
          ============================================================ */}
      <div className="control-group">
        <button 
          className="btn-primary" 
          onClick={onFetch}
          disabled={loading || !isKeyValid}
        >
          {loading ? (
            <PacmanLoader size={20} color="white" />
          ) : (
            <>
              <span className="icon">🔄</span> Rafraîchir
            </>
          )}
        </button>
        {!isKeyValid && (
          <small className="control-help" style={{ color: '#e74c3c' }}>
            ⚠️ Veuillez entrer et sauvegarder votre clé API (bouton 💾)
          </small>
        )}
        {isKeyValid && !loading && (
          <small className="control-help" style={{ color: '#27ae60' }}>
            ✅ Prêt pour la recherche
          </small>
        )}
      </div>

      {/* ============================================================
          EXPORT
          ============================================================ */}
      <div className="control-group">
        <label className="control-label">
          <span className="icon">📥</span> Exporter
        </label>
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
        <small className="control-help">Exporte les données filtrées actuellement affichées</small>
      </div>
    </div>
  );
};

export default Controls;
