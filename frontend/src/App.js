import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import './App.css';
import Map from './components/Map/Map';
import Controls from './components/Controls/Controls';
import FireChart from './components/Charts/FireChart';
import Alerts from './components/Alerts/Alerts';
import { getFires, getSources, exportCSV, exportGeoJSON } from './services/api';

function App() {
  const [fires, setFires] = useState([]);
  const [filteredFires, setFilteredFires] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState('VIIRS_SNPP_NRT');
  const [dayRange, setDayRange] = useState(3);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSdis, setShowSdis] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [apiInfo, setApiInfo] = useState(null);

  // Charger les sources au démarrage
  useEffect(() => {
    const loadSources = async () => {
      try {
        const data = await getSources();
        setSources(Object.entries(data.sources).map(([key, label]) => ({ value: key, label })));
      } catch (error) {
        toast.error('Erreur lors du chargement des sources');
      }
    };
    loadSources();
  }, []);

  // Appliquer le mode sombre
  useEffect(() => {
    document.body.className = darkMode ? 'dark' : '';
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Charger les feux
  const fetchFires = async () => {
    const apiKey = localStorage.getItem('firms_map_key');
    if (!apiKey || apiKey.trim() === '') {
      toast.error('⚠️ Veuillez entrer votre clé API FIRMS dans les paramètres');
      return;
    }
    
    setLoading(true);
    try {
      const data = await getFires({
        source: selectedSource,
        days: dayRange,
        startDate,
        endDate
      });
      
      setFires(data.data);
      setFilteredFires(data.data);
      setLastUpdate(data.timestamp);
      setApiInfo({
        format: data.format,
        area: data.area,
        total_world: data.total_world,
        total_france: data.total_france,
        count: data.count,
        bbox: data.bbox
      });
      
      let message = `✅ ${data.count} feux en France`;
      if (data.total_world) {
        message += ` (${data.total_world} dans le monde, ${data.total_france} en France)`;
      }
      toast.success(message);
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(error.message || 'Erreur lors du chargement des feux');
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les feux
  const handleFilterChange = (filters) => {
    let filtered = [...fires];
    
    if (filters.highConfidence) {
      filtered = filtered.filter(f => 
        ['high', 'h', '100', 'nominal'].includes(f.confidence?.toLowerCase())
      );
    }
    
    if (filters.frp) {
      filtered = filtered.filter(f => (f.frp || 0) >= 50);
    }
    
    setFilteredFires(filtered);
  };

  // Exporter
  const handleExport = async (format) => {
    if (filteredFires.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    try {
      const result = format === 'csv' 
        ? await exportCSV(filteredFires)
        : await exportGeoJSON(filteredFires);
      
      toast.success(`✅ Export ${format.toUpperCase()} sauvegardé`);
      window.open(result.downloadUrl, '_blank');
    } catch (error) {
      toast.error(error.message || 'Erreur lors de l\'export');
    }
  };

  // Détecter les hotspots (alertes)
  const detectHotspots = (fires) => {
    const RADIUS_DEG = 0.1;
    const MIN_FIRES = 5;
    const hotspots = [];

    for (let i = 0; i < fires.length; i++) {
      let count = 1;
      for (let j = i + 1; j < fires.length; j++) {
        const d = distance(
          fires[i].latitude, fires[i].longitude,
          fires[j].latitude, fires[j].longitude
        );
        if (d < RADIUS_DEG) count++;
      }
      if (count >= MIN_FIRES) {
        hotspots.push({
          lat: fires[i].latitude,
          lng: fires[i].longitude,
          count
        });
      }
    }

    // Dédoublonner
    const unique = [];
    for (const h of hotspots) {
      let dup = false;
      for (const u of unique) {
        if (distance(h.lat, h.lng, u.lat, u.lng) < RADIUS_DEG * 0.5) {
          dup = true;
          break;
        }
      }
      if (!dup) unique.push(h);
    }

    setAlerts(unique);
  };

  // Helper distance
  const distance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) / 111;
  };

  // Mettre à jour les alertes quand les feux filtrés changent
  useEffect(() => {
    if (filteredFires.length > 0) {
      detectHotspots(filteredFires);
    } else {
      setAlerts([]);
    }
  }, [filteredFires]);

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Toaster position="top-right" />
      
      <header className="app-header">
        <h1><span className="fire-icon">🔥</span> Feux & Vents & SDIS</h1>
        <div className="header-controls">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="dark-toggle"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="header-subtitle">NASA FIRMS • Open-Meteo • SDIS</span>
        </div>
      </header>

      <main className="app-main">
        <aside className="app-sidebar">
          <Controls
            sources={sources}
            selectedSource={selectedSource}
            setSelectedSource={setSelectedSource}
            dayRange={dayRange}
            setDayRange={setDayRange}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            onFetch={fetchFires}
            onFilterChange={handleFilterChange}
            onExport={handleExport}
            loading={loading}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
            showSdis={showSdis}
            setShowSdis={setShowSdis}
            darkMode={darkMode}
          />
          
          <div className="stats-panel">
            <div className="stat-item">
              <span className="stat-label">Feux en France</span>
              <span className="stat-value">{filteredFires.length}</span>
            </div>
            {apiInfo && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Total dans le monde</span>
                  <span className="stat-value small">{apiInfo.total_world?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total en France</span>
                  <span className="stat-value small">{apiInfo.total_france?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Format</span>
                  <span className="stat-value small">{apiInfo.format || 'N/A'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Zone</span>
                  <span className="stat-value small">{apiInfo.area || 'N/A'}</span>
                </div>
              </>
            )}
            {lastUpdate && (
              <div className="stat-item">
                <span className="stat-label">Mise à jour</span>
                <span className="stat-value small">
                  {new Date(lastUpdate).toLocaleString('fr-FR')}
                </span>
              </div>
            )}
          </div>

          {alerts.length > 0 && <Alerts alerts={alerts} />}
        </aside>

        <div className="app-content">
          <div className="map-container">
            <Map
              fires={filteredFires}
              showHeatmap={showHeatmap}
              showSdis={showSdis}
              darkMode={darkMode}
              alerts={alerts}
            />
          </div>
          <div className="chart-container">
            <FireChart fires={filteredFires} darkMode={darkMode} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Données feux : <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA FIRMS</a> • 
          Données vent : <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> • 
          Données SDIS : <a href="https://data.gouv.fr/" target="_blank" rel="noopener noreferrer">data.gouv.fr</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
