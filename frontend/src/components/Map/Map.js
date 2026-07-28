import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './Map.css';
import { fetchWeatherData, getFallbackWeatherData } from '../../services/weatherService';

// Liste des couches WMS pour référence
const WMS_LAYERS = [
  // --- Open-Meteo (météo en points) ---
  { value: 'temperature', label: '🌡️ Température', type: 'weather' },
  { value: 'precipitation', label: '🌧️ Précipitations', type: 'weather' },
  { value: 'cloudcover', label: '☁️ Couverture nuageuse', type: 'weather' },
  // --- NASA GIBS (WMS) ---
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
  activeWmsLayers = [],
  wmsOpacity = 0.6,
}) => {
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const heatmapRef = useRef(null);
  const alertRefs = useRef([]);
  const velocityRef = useRef(null);
  // Références pour les couches WMS
  const wmsLayersRef = useRef({});
  const weatherLayerRef = useRef(null);
  const weatherDataRef = useRef(null);

  // Fonction pour obtenir la couleur selon la température
  const getColorForTemperature = (temp) => {
    if (temp > 30) return '#e74c3c'; // Rouge
    if (temp > 25) return '#e67e22'; // Orange
    if (temp > 20) return '#f1c40f'; // Jaune
    if (temp > 15) return '#2ecc71'; // Vert
    if (temp > 10) return '#3498db'; // Bleu
    if (temp > 5) return '#2980b9'; // Bleu foncé
    return '#8e44ad'; // Violet
  };

  // Fonction pour obtenir l'icône météo
  const getWeatherIcon = (cloudCover, precipitation) => {
    if (precipitation > 1) return '🌧️';
    if (precipitation > 0.1) return '🌦️';
    if (cloudCover > 80) return '☁️';
    if (cloudCover > 40) return '⛅';
    return '☀️';
  };

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

  // Gestion des couches GIBS WMS (multi-couches)
  useEffect(() => {
    if (!mapRef.current) return;

    // Supprimer les couches GIBS qui ne sont plus actives
    const activeGibsValues = activeWmsLayers
      .filter(l => {
        const def = WMS_LAYERS.find(d => d.value === l.value);
        return def && def.type === 'gibs';
      })
      .map(l => l.value);

    Object.keys(wmsLayersRef.current).forEach(key => {
      if (!activeGibsValues.includes(key)) {
        if (wmsLayersRef.current[key] && mapRef.current) {
          mapRef.current.removeLayer(wmsLayersRef.current[key]);
          delete wmsLayersRef.current[key];
        }
      }
    });

    // Ajouter ou mettre à jour les couches GIBS actives
    activeWmsLayers.forEach(layerDef => {
      const fullDef = WMS_LAYERS.find(l => l.value === layerDef.value);
      if (!fullDef || fullDef.type !== 'gibs') return;

      const existingLayer = wmsLayersRef.current[layerDef.value];
      const opacity = layerDef.opacity || wmsOpacity;

      // Mettre à jour l'opacité si la couche existe déjà
      if (existingLayer) {
        existingLayer.setOpacity(opacity);
        return;
      }

      // Créer la couche GIBS
      const gibsLayer = fullDef.layer;
      console.log(`🌿 Ajout de la couche GIBS: ${gibsLayer} (opacité ${opacity})`);
      const layer = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi', {
        layers: gibsLayer,
        format: 'image/png',
        transparent: true,
        opacity: opacity,
        attribution: 'NASA GIBS',
        crs: L.CRS.EPSG4326,
        maxZoom: 10,
        minZoom: 3,
      }).addTo(mapRef.current);

      wmsLayersRef.current[layerDef.value] = layer;
    });

    // Nettoyage
    return () => {
      Object.values(wmsLayersRef.current).forEach(layer => {
        if (mapRef.current) {
          mapRef.current.removeLayer(layer);
        }
      });
      wmsLayersRef.current = {};
    };
  }, [activeWmsLayers, wmsOpacity]);

  // Gestion de la couche météo (points) - une seule couche météo à la fois
  useEffect(() => {
    if (!mapRef.current) return;

    // Supprimer l'ancienne couche météo
    if (weatherLayerRef.current) {
      mapRef.current.removeLayer(weatherLayerRef.current);
      weatherLayerRef.current = null;
    }

    // Vérifier si une couche météo est active
    const weatherLayer = activeWmsLayers.find(l => {
      const def = WMS_LAYERS.find(d => d.value === l.value);
      return def && def.type === 'weather';
    });

    if (!weatherLayer) return;

    const opacity = weatherLayer.opacity || wmsOpacity;
    const layerDef = WMS_LAYERS.find(l => l.value === weatherLayer.value);
    if (!layerDef) return;

    let isMounted = true;

    const loadWeatherData = async () => {
      try {
        let data = await fetchWeatherData();
        if (!data || data.length === 0) {
          data = getFallbackWeatherData();
        }
        weatherDataRef.current = data;

        if (!isMounted || !data || data.length === 0) return;

        weatherLayerRef.current = L.layerGroup().addTo(mapRef.current);

        data.forEach(point => {
          const temp = Math.round(point.temperature);
          const feelsLike = Math.round(point.apparentTemperature || point.temperature);
          const humidity = Math.round(point.humidity || 0);
          const wind = Math.round(point.windSpeed || 0);
          const precip = point.precipitation?.toFixed(1) || '0.0';
          const cloud = Math.round(point.cloudCover || 0);
          const icon = getWeatherIcon(point.cloudCover || 0, point.precipitation || 0);

          // Popup avec toutes les informations
          const popupContent = `
            <strong>${icon} ${temp}°C</strong><br/>
            <b>Ressenti:</b> ${feelsLike}°C<br/>
            <b>Humidité:</b> ${humidity}%<br/>
            <b>Vent:</b> ${wind} km/h<br/>
            <b>Précipitations:</b> ${precip} mm<br/>
            <b>Couverture:</b> ${cloud}%<br/>
            <hr style="margin:4px 0;border:none;border-top:1px solid #eee;"/>
            <b>Coordonnées:</b><br/>
            Lat: ${point.latitude.toFixed(2)}, Lon: ${point.longitude.toFixed(2)}
          `;

          // Cercle coloré selon la température
          const marker = L.circleMarker([point.latitude, point.longitude], {
            radius: 14,
            fillColor: getColorForTemperature(point.temperature),
            color: 'rgba(255,255,255,0.6)',
            weight: 2,
            opacity: opacity + 0.2,
            fillOpacity: opacity * 0.85,
          }).bindPopup(popupContent);

          // Étiquette avec la température
          const label = L.marker([point.latitude, point.longitude], {
            icon: L.divIcon({
              html: `<div style="font-size:11px;font-weight:bold;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.8),0 0 8px rgba(0,0,0,0.6);text-align:center;margin-top:-28px;line-height:1.2;pointer-events:none;">${temp}°</div>`,
              className: 'weather-label',
              iconSize: [34, 20],
              iconAnchor: [17, 10],
            })
          });

          weatherLayerRef.current.addLayer(marker);
          weatherLayerRef.current.addLayer(label);
        });

        console.log(`🌦️ ${data.length} points météo affichés (opacité ${opacity})`);

      } catch (error) {
        console.error('❌ Erreur chargement météo:', error);
        // Fallback avec données simulées
        const fallbackData = getFallbackWeatherData();
        if (fallbackData && fallbackData.length > 0 && isMounted) {
          weatherLayerRef.current = L.layerGroup().addTo(mapRef.current);
          fallbackData.forEach(point => {
            const temp = Math.round(point.temperature);
            const marker = L.circleMarker([point.latitude, point.longitude], {
              radius: 12,
              fillColor: getColorForTemperature(point.temperature),
              color: 'rgba(255,255,255,0.6)',
              weight: 1.5,
              opacity: opacity + 0.2,
              fillOpacity: opacity * 0.8,
            }).bindPopup(`🌡️ ${temp}°C (données simulées)`);
            weatherLayerRef.current.addLayer(marker);
          });
        }
      }
    };

    loadWeatherData();

    return () => {
      isMounted = false;
      if (weatherLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
    };
  }, [activeWmsLayers, wmsOpacity]);

  // Redimensionnement
  useEffect(() => {
    const handleResize = () => { if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 100); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div id="map" className="map-container" />;
};

export default Map;
