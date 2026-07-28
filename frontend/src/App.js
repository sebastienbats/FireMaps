import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import './App.css';
import Map from './components/Map/Map';
import Controls from './components/Controls/Controls';
import FireChart from './components/Charts/FireChart';
import Alerts from './components/Alerts/Alerts';
import { getFires, getSources, exportCSV, exportGeoJSON } from './services/api';
import { fetchWindData, fetchWindDataSimple, getFallbackWindData } from './services/windService';

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
  const [showWind, setShowWind] = useState(false);
  const [windData, setWindData] = useState(null);
  const [windLoading, setWindLoading] = useState(false);
  const [windError, setWindError] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [apiInfo, setApiInfo] = useState(null);
  // Couches WMS
  const [wmsLayer, setWmsLayer] = useState(null);
  const [wmsOpacity, setWmsOpacity] = useState(0.6);

  // Sources
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

  // Dark mode
  useEffect(() => {
    document.body.className = darkMode ? 'dark' : '';
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Vent
  const loadWindData = async () => {
    if (windLoading) return;
    setWindLoading(true);
    setWindError(false);
    const toastId = toast.loading('🌬️ Chargement des données vent...');
    try {
      let data = await fetchWindData();
      if (!data) data = await fetchWindDataSimple();
      if (!data) data = getFallbackWindData();
      if (data) {
        setWindData(data);
        toast.success('🌬️ Données vent chargées', { id: toastId });
        setWindError(false);
      } else {
        throw new Error('Aucune donnée de vent disponible');
      }
    } catch (error) {
      console.error('❌ Erreur vent:', error);
      setWindError(true);
      toast.error('❌ Impossible de charger les données vent', { id: toastId });
      setShowWind(false);
    } finally {
      setWindLoading(false);
    }
  };

  const handleWindToggle = async () => {
    if (showWind) {
      setShowWind(false);
      setWindData(null);
      toast.success('🌬️ Couche vent désactivée');
    } else {
      setShowWind(true);
      if (!windData && !windError) {
        await loadWindData();
      } else if (windError) {
        toast.error('🌬️ Données vent indisponibles. Réessayez plus tard.');
        setShowWind(false);
      }
    }
  };

  // Feux
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
      if (data.total_world) message += ` (${data.total_world} dans le monde, ${data.total_france} en France)`;
      toast.success(message);
      if (showHeatmap) {
        setShowHeatmap(false);
        setTimeout(() => setShowHeatmap(true), 100);
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(error.message || 'Erreur lors du chargement des feux');
    } finally {
      setLoading(false);
    }
  };

  // Filtres
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

  // Export
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

  // Hotspots
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
        hotspots.push({ lat: fires[i].latitude, lng: fires[i].longitude, count });
      }
    }
    const unique = [];
    for (const h of hotspots) {
      let dup = false;
      for (const u of unique) {
        if (distance(h.lat, h.lng, u.lat, u.lng) < RADIUS_DEG * 0.5) { dup = true; break; }
      }
      if (!dup) unique.push(h);
    }
    setAlerts(unique);
  };

  const distance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) / 111;
  };

  useEffect(() => {
    if (filteredFires.length > 0) {
      detectHotspots(filteredFires);
    } else {
      setAlerts([]);
    }
  }, [filteredFires]);

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: {
          background: darkMode ? '#1f2937' : '#ffffff',
          color: darkMode ? '#e5e7eb' : '#1f2937',
        },
      }} />

      <header className="app-header">
        <h1><span className="fire-icon">🔥</span> Feux & Vents & Météo & SDIS</h1>
        <div className="header-controls">
          <button onClick={() => setDarkMode(!darkMode)} className="dark-toggle" aria-label="Basculer le mode sombre">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="header-subtitle">NASA FIRMS • Open‑Meteo • GIBS • SDIS</span>
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
            showWind={showWind}
            setShowWind={handleWindToggle}
            windLoading={windLoading}
            darkMode={darkMode}
            wmsLayer={wmsLayer}
            setWmsLayer={setWmsLayer}
            wmsOpacity={wmsOpacity}
            setWmsOpacity={setWmsOpacity}
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
                <span className="stat-value small">{new Date(lastUpdate).toLocaleString('fr-FR')}</span>
              </div>
            )}
            {windData && (
              <div className="stat-item">
                <span className="stat-label">Vent</span>
                <span className="stat-value small">✅ Chargé</span>
              </div>
            )}
            {windError && (
              <div className="stat-item">
                <span className="stat-label">Vent</span>
                <span className="stat-value small" style={{ color: '#e74c3c' }}>❌ Indisponible</span>
              </div>
            )}
            {wmsLayer && (
              <div className="stat-item">
                <span className="stat-label">WMS</span>
                <span className="stat-value small">✅ Actif</span>
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
              showWind={showWind}
              windData={windData}
              onWindToggle={handleWindToggle}
              wmsLayer={wmsLayer}
              wmsOpacity={wmsOpacity}
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
          Données vent/météo : <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open‑Meteo</a> •
          NDVI/LST : <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA GIBS</a> •
          SDIS : <a href="https://data.gouv.fr/" target="_blank" rel="noopener noreferrer">data.gouv.fr</a>
        </p>
        <p style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '2px' }}>
          Version 1.0.0 • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

export default App;
