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
  const [isKeyValid, setIsKeyValid] = useState(false);

  const handleFilterChange = () => {
    onFilterChange({ highConfidence, frp });
  };

  const handleSaveApiKey = () => {
    const trimmedKey = apiKey.trim();
    if (trimmedKey) {
      // Validation basique : la clé doit faire au moins 32 caractères
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

  return (
    <div className="controls">
      <div className="control-group">
        <label className="control-label">
          <span className="icon">🔑</span> Clé API FIRMS
        </label>
        <div className="control-input-group">
          <input 
            type="password" 
            placeholder="Entrez votre MAP_KEY (ex: 7427d7a5...)"
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
          <div className={`api-status ${apiKeyStatus.includes('✅') ? 'success' : 'error'}`}>
            {apiKeyStatus}
          </div>
        )}
        <small className="control-help">
          Obtenez une clé sur <a href="https://firms.modaps.eosdis.nasa.gov/mapkey/" target="_blank" rel="noopener noreferrer">firms.modaps.eosdis.nasa.gov</a>
        </small>
        {apiKey && (
          <small className="control-help" style={{ color: isKeyValid ? '#27ae60' : '#f39c12' }}>
            {isKeyValid ? `✅ Clé chargée (${apiKey.length} caractères)` : '⚠️ Clé non sauvegardée'}
          </small>
        )}
      </div>

      {/* ... reste du composant inchangé ... */}
    </div>
  );
};

export default Controls;
