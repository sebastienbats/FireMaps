import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './Map.css';

// Liste des couches WMS disponibles
const WMS_LAYERS = [
  { value: 'temperature_2m', label: '🌡️ Température', type: 'open-meteo' },
  { value: 'precipitation', label: '🌧️ Précipitations', type: 'open-meteo' },
  { value: 'cloudcover', label: '☁️ Couverture nuageuse', type: 'open-meteo' },
  { value: 'pressure_msl', label: '📊 Pression', type: 'open-meteo' },
  { value: 'wind_speed_10m', label: '💨 Vitesse du vent', type: 'open-meteo' },
  { value: 'relative_humidity_2m', label: '💧 Humidité', type: 'open-meteo' },
  // NASA GIBS
  { value: 'ndvi', label: '🌿 Végétation (NDVI)', type: 'gibs', layer: 'MOD13A2_NDVI' },
  { value: 'lst_day', label: '🌡️ LST (jour)', type: 'gibs', layer: 'MOD11A1_LST_Day_1km' },
  { value: 'lst_night', label: '🌡️ LST (nuit)', type: 'gibs', layer: 'MOD11A1_LST_Night_1km' },
];

// Vérification des plugins
const isHeatLayerAvailable = () => {
  try { return typeof L !== 'undefined' && typeof L.heatLayer === 'function'; } catch(e) { return false; }
};
const isVelocityLayerAvailable = () => {
  try { return typeof L !== 'undefined' && typeof L.velocityLayer === 'function'; } catch(e) { return false; }
};

// Chargement dynamique de leaflet.heat
const loadHeatPlugin = () => {
  return new Promise((resolve, reject) => {
    if (isHeatLayerAvailable()) return resolve();
    console.log('📦 Tentative de chargement dynamique de leaflet.heat...');
    const cdnUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js',
      'https://cdn.jsdelivr.net/npm/leaflet-heat@0.2.0/leaflet-heat.js',
      'https://unpkg.com/leaflet-heat@0.2.0/dist/leaflet-heat.js'
    ];
    let index = 0;
    const tryLoad = () => {
      if (index >= cdnUrls.length) return reject(new Error('Tous les CDN ont échoué'));
      const script = document.createElement('script');
      script.src = cdnUrls[index];
      script.async = true;
      script.onload = () => {
        if (isHeatLayerAvailable()) {
          console.log(`✅ leaflet.heat chargé depuis ${cdnUrls[index]}`);
          resolve();
        } else { index++; tryLoad(); }
      };
      script.onerror = () => { index++; tryLoad(); };
      document.head.appendChild(script);
    };
    tryLoad();
  });
};

const Map = ({
  fires,
  showHeatmap,
  showSdis,
  darkMode,
  alerts,
  showWind = false,
  windData = null,
  onWindToggle,
  wmsLayer = null,
  wmsOpacity = 0.6,
}) => {
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const heatmapRef = useRef(null);
  const alertRefs = useRef([]);
  const velocityRef = useRef(null);
  const wmsTileRef = useRef(null);
  const wmsLayerRef = useRef(null);

  // Initialisation de la carte
  useEffect(() => {
    if (!mapRef.current) {
      console.log('🗺️ Initialisation de la carte...');
      mapRef.current = L.map('map', { center: [46.6, 2.2], zoom: 6, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
      console.log('✅ Carte initialisée');
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Redimensionnement
  useEffect(() => {
    if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 100);
  }, [darkMode]);

  // Marqueurs de feux
  useEffect(() => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();
    if (fires && fires.length > 0) {
      const fireIcon = L.divIcon({
        html: '<div class="fire-marker">🔥</div>',
        className: 'fire-marker-container',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });
      fires.forEach(fire => {
        const popup = `<strong>🔥 Feu</strong><br/><b>Lat:</b> ${fire.latitude.toFixed(4)}<br/><b>Lon:</b> ${fire.longitude.toFixed(4)}<br/><b>Confiance:</b> ${fire.confidence || 'N/A'}<br/><b>FRP:</b> ${(fire.frp || 0).toFixed(1)} MW<br/><b>Date:</b> ${fire.acq_date || 'N/A'}<br/>${fire.type ? `<b>Type:</b> ${fire.type}` : ''}`;
        const marker = L.marker([fire.latitude, fire.longitude], { icon: fireIcon }).bindPopup(popup);
        markersRef.current.addLayer(marker);
      });
      if (fires.length > 0 && !mapRef.current._initialized) {
        const bounds = L.latLngBounds(fires.map(f => [f.latitude, f.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
        mapRef.current._initialized = true;
      }
    }
    // Alertes
    alertRefs.current.forEach(circle => { if (mapRef.current) mapRef.current.removeLayer(circle); });
    alertRefs.current = [];
    if (alerts && alerts.length > 0) {
      alerts.forEach(alert => {
        const circle = L.circle([alert.lat, alert.lng], {
          radius: 5000,
          color: '#e74c3c',
          fillColor: '#e74c3c',
          fillOpacity: 0.2,
          weight: 2
        }).bindPopup(`🔥 Hotspot : ${alert.count} feux dans un rayon de 5 km`);
        circle.addTo(mapRef.current);
        alertRefs.current.push(circle);
      });
    }
  }, [fires, alerts]);

  // Heatmap
  useEffect(() => {
    if (!mapRef.current) return;
    const updateHeatmap = async () => {
      if (heatmapRef.current) { mapRef.current.removeLayer(heatmapRef.current); heatmapRef.current = null; }
      if (!showHeatmap || !fires || fires.length === 0) return;
      if (!isHeatLayerAvailable()) {
        console.warn('⚠️ L.heatLayer non disponible, tentative de chargement...');
        try { await loadHeatPlugin(); } catch (error) { console.error('❌ Échec du chargement de leaflet.heat:', error); return; }
      }
      if (isHeatLayerAvailable()) {
        console.log(`🔥 Création de la heatmap avec ${fires.length} points`);
        const points = fires.map(f => [f.latitude, f.longitude, f.frp || 1]);
        heatmapRef.current = L.heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 10,
          gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
        }).addTo(mapRef.current);
      }
    };
    updateHeatmap();
  }, [showHeatmap, fires]);

  // Vent
  useEffect(() => {
    if (!mapRef.current) return;
    if (velocityRef.current) { mapRef.current.removeLayer(velocityRef.current); velocityRef.current = null; }
    if (showWind && windData && isVelocityLayerAvailable()) {
      console.log('🌬️ Création de la couche vent...');
      try {
        velocityRef.current = L.velocityLayer({
          displayValues: true,
          data: windData,
          opacity: 0.8,
          maxVelocity: 25,
          velocityType: 'wind',
          colorScale: ['#003366', '#0066cc', '#0099ff', '#66ccff', '#ffff00', '#ff9900', '#ff3300', '#990000']
        }).addTo(mapRef.current);
        console.log('✅ Couche vent ajoutée');
      } catch (error) {
        console.error('❌ Erreur lors de l\'ajout de la couche vent:', error);
      }
    } else if (showWind && !windData) {
      console.warn('🌬️ Aucune donnée vent disponible');
      if (onWindToggle) onWindToggle(true);
    }
  }, [showWind, windData, onWindToggle]);

  // Couches WMS (Open-Meteo via tuiles raster)
  useEffect(() => {
    if (!mapRef.current) return;

    // Supprimer les anciennes couches
    if (wmsTileRef.current) {
      mapRef.current.removeLayer(wmsTileRef.current);
      wmsTileRef.current = null;
    }
    if (wmsLayerRef.current) {
      mapRef.current.removeLayer(wmsLayerRef.current);
      wmsLayerRef.current = null;
    }

    if (!wmsLayer) return;

    const layerDef = WMS_LAYERS.find(l => l.value === wmsLayer);
    if (!layerDef) return;

    if (layerDef.type === 'open-meteo') {
      // URL correcte des tuiles Open-Meteo
      const url = `https://api.open-meteo.com/v1/map/{z}/{x}/{y}/${wmsLayer}.png`;
      console.log(`🌦️ Ajout de la couche Open-Meteo: ${wmsLayer} (opacité ${wmsOpacity})`);
      wmsTileRef.current = L.tileLayer(url, {
        opacity: wmsOpacity,
        attribution: 'Météo © Open‑Meteo',
        maxZoom: 8,
        minZoom: 3,
        tileSize: 256,
        crossOrigin: true,
        // Ajout du paramètre time pour les données les plus récentes
        time: 'latest'
      }).addTo(mapRef.current);
    } else if (layerDef.type === 'gibs') {
      const gibsLayer = layerDef.layer;
      console.log(`🌿 Ajout de la couche GIBS: ${gibsLayer} (opacité ${wmsOpacity})`);
      wmsLayerRef.current = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi', {
        layers: gibsLayer,
        format: 'image/png',
        transparent: true,
        opacity: wmsOpacity,
        attribution: 'NASA GIBS',
        crs: L.CRS.EPSG4326,
        maxZoom: 10,
        minZoom: 3,
      }).addTo(mapRef.current);
    }
  }, [wmsLayer, wmsOpacity]);

  // Mise à jour de l'opacité
  useEffect(() => {
    if (wmsTileRef.current && mapRef.current) {
      wmsTileRef.current.setOpacity(wmsOpacity);
    }
    if (wmsLayerRef.current && mapRef.current) {
      wmsLayerRef.current.setOpacity(wmsOpacity);
    }
  }, [wmsOpacity]);

  // Redimensionnement
  useEffect(() => {
    const handleResize = () => { if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 100); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div id="map" className="map-container" />;
};

export default Map;
