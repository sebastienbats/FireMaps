import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './Map.css';
import { fetchWeatherData, getFallbackWeatherData } from '../../services/weatherService';

// Liste des couches WMS disponibles
const WMS_LAYERS = [
  // --- Open-Meteo (météo en points) ---
  { value: 'temperature', label: '🌡️ Température', type: 'weather' },
  { value: 'precipitation', label: '🌧️ Précipitations', type: 'weather' },
  { value: 'cloudcover', label: '☁️ Couverture nuageuse', type: 'weather' },
  // --- Open-Meteo (tuiles) ---
  { 
    value: 'temperature_map', 
    label: '🌡️ Température (tuiles)', 
    type: 'openmeteo_tile',
    layer: 'temperature_2m'
  },
  { 
    value: 'precipitation_map', 
    label: '🌧️ Précipitations (tuiles)', 
    type: 'openmeteo_tile',
    layer: 'precipitation'
  },
  { 
    value: 'cloudcover_map', 
    label: '☁️ Couverture nuageuse (tuiles)', 
    type: 'openmeteo_tile',
    layer: 'cloudcover'
  },
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

// Fonction pour créer une couche Open-Meteo
const createOpenMeteoLayer = (layerName, opacity) => {
  // Mapping des noms de couches
  const layerMap = {
    'temperature_2m': 'temperature_2m',
    'precipitation': 'precipitation',
    'cloudcover': 'cloudcover',
  };

  const actualLayer = layerMap[layerName] || layerName;
  
  // URL des tuiles Open-Meteo
  const tileUrl = `https://api.open-meteo.com/v1/map/{z}/{x}/{y}/${actualLayer}.png`;
  
  return L.tileLayer(tileUrl, {
    opacity: opacity,
    attribution: 'Météo © Open-Meteo',
    maxZoom: 8,
    minZoom: 3,
    tileSize: 256,
    crossOrigin: true,
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
  const wmsLayersRef = useRef({});
  const weatherLayerRef = useRef(null);
  const weatherDataRef = useRef(null);

  // Fonctions météo
  const getColorForTemperature = (temp) => {
    if (temp > 30) return '#e74c3c';
    if (temp > 25) return '#e67e22';
    if (temp > 20) return '#f1c40f';
    if (temp > 15) return '#2ecc71';
    if (temp > 10) return '#3498db';
    if (temp > 5) return '#2980b9';
    return '#8e44ad';
  };

  const getWeatherIcon = (weatherType, precipitation, cloudCover) => {
    if (weatherType === 'precipitation') {
      if (precipitation > 5) return '⛈️';
      if (precipitation > 2) return '🌧️';
      if (precipitation > 0.5) return '🌦️';
      if (precipitation > 0.1) return '☔';
      return '☀️';
    }
    if (precipitation > 1) return '🌧️';
    if (precipitation > 0.1) return '🌦️';
    if (cloudCover > 80) return '☁️';
    if (cloudCover > 40) return '⛅';
    return '☀️';
  };

  const getPrecipitationColor = (precipitation) => {
    if (precipitation > 5) return '#8e44ad';
    if (precipitation > 2) return '#e74c3c';
    if (precipitation > 1) return '#e67e22';
    if (precipitation > 0.5) return '#f1c40f';
    if (precipitation > 0.1) return '#3498db';
    return '#2ecc71';
  };

  const getPrecipitationSize = (precipitation) => {
    if (precipitation > 5) return 22;
    if (precipitation > 2) return 18;
    if (precipitation > 1) return 15;
    if (precipitation > 0.5) return 12;
    if (precipitation > 0.1) return 10;
    return 8;
  };

  // === INITIALISATION DE LA CARTE ===
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

  // === HEATMAP ===
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

  // === COUCHE VENT ===
  useEffect(() => {
    console.log('🔄 useEffect vent exécuté', { 
      showWind, 
      windData: !!windData, 
      isVelocityAvailable: isVelocityLayerAvailable() 
    });

    if (!mapRef.current) return;

    if (velocityRef.current) {
      mapRef.current.removeLayer(velocityRef.current);
      velocityRef.current = null;
    }

    if (showWind && windData) {
      if (isVelocityLayerAvailable()) {
        console.log('🌬️ Création de la couche vent avec données');
        try {
          velocityRef.current = L.velocityLayer({
            displayValues: true,
            data: windData,
            opacity: 0.8,
            maxVelocity: 25,
            velocityType: 'wind',
            colorScale: ['#003366', '#0066cc', '#0099ff', '#66ccff', '#ffff00', '#ff9900', '#ff3300', '#990000']
          }).addTo(mapRef.current);
          console.log('✅ Couche vent ajoutée avec succès');
        } catch (error) {
          console.error('❌ Erreur lors de l\'ajout de la couche vent:', error);
        }
      } else {
        console.warn('🌬️ Plugin Leaflet-Velocity non disponible');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-velocity/0.2.0/leaflet-velocity.min.js';
        script.onload = () => {
          console.log('✅ Leaflet-Velocity chargé dynamiquement, réessai...');
          setTimeout(() => {
            if (showWind && windData && isVelocityLayerAvailable() && mapRef.current) {
              try {
                velocityRef.current = L.velocityLayer({
                  displayValues: true,
                  data: windData,
                  opacity: 0.8,
                  maxVelocity: 25,
                  velocityType: 'wind',
                  colorScale: ['#003366', '#0066cc', '#0099ff', '#66ccff', '#ffff00', '#ff9900', '#ff3300', '#990000']
                }).addTo(mapRef.current);
                console.log('✅ Couche vent ajoutée après chargement dynamique');
              } catch (err) {
                console.error('❌ Erreur lors de l\'ajout après chargement dynamique:', err);
              }
            }
          }, 500);
        };
        script.onerror = () => {
          console.error('❌ Échec du chargement dynamique de Leaflet-Velocity');
        };
        document.head.appendChild(script);
      }
    } else if (showWind && !windData) {
      console.warn('🌬️ Aucune donnée vent disponible');
      if (onWindToggle) onWindToggle(true);
    }
  }, [showWind, windData, onWindToggle]);

  // === GESTION DES COUCHES WMS ===
  useEffect(() => {
    if (!mapRef.current) return;

    const activeValues = activeWmsLayers.map(l => l.value);

    // Supprimer les couches inactives
    Object.keys(wmsLayersRef.current).forEach(key => {
      if (!activeValues.includes(key)) {
        if (wmsLayersRef.current[key] && mapRef.current) {
          mapRef.current.removeLayer(wmsLayersRef.current[key]);
          delete wmsLayersRef.current[key];
          console.log(`🗑️ Couche supprimée: ${key}`);
        }
      }
    });

    // Ajouter les couches actives
    activeWmsLayers.forEach(layerDef => {
      const fullDef = WMS_LAYERS.find(l => l.value === layerDef.value);
      if (!fullDef) return;

      const existingLayer = wmsLayersRef.current[layerDef.value];
      const opacity = layerDef.opacity || wmsOpacity;

      if (existingLayer) {
        existingLayer.setOpacity(opacity);
        return;
      }

      // === COUCHES OPEN-METEO TILES ===
      if (fullDef.type === 'openmeteo_tile') {
        const layerName = fullDef.layer;
        console.log(`🌦️ Ajout de la couche Open-Meteo: ${layerName}`);
        
        const layer = createOpenMeteoLayer(layerName, opacity);

        // Événements pour le débogage
        let tileErrorCount = 0;
        let tileLoadCount = 0;

        layer.on('loading', () => {
          console.log(`⏳ Chargement des tuiles ${layerName}...`);
        });

        layer.on('load', () => {
          console.log(`✅ ${layerName} chargé avec succès (${tileLoadCount} tuiles)`);
        });

        layer.on('tileload', () => {
          tileLoadCount++;
          if (tileLoadCount % 10 === 0) {
            console.log(`📊 ${layerName}: ${tileLoadCount} tuiles chargées`);
          }
        });

        layer.on('tileerror', (error) => {
          tileErrorCount++;
          console.error(`❌ Erreur tuile ${layerName} #${tileErrorCount}:`, error);
          if (error.tile) {
            console.error(`   Tuile URL: ${error.tile.src}`);
          }
        });

        layer.addTo(mapRef.current);
        wmsLayersRef.current[layerDef.value] = layer;
        console.log(`✅ Couche ${layerName} ajoutée à la carte`);

        // Forcer un redimensionnement
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
            console.log(`🔄 Carte redimensionnée après ajout de ${layerName}`);
          }
        }, 500);
      }
    });

    return () => {
      Object.values(wmsLayersRef.current).forEach(layer => {
        if (mapRef.current) {
          mapRef.current.removeLayer(layer);
        }
      });
      wmsLayersRef.current = {};
    };
  }, [activeWmsLayers, wmsOpacity]);

  // === COUCHE MÉTÉO (points) ===
  useEffect(() => {
    if (!mapRef.current) return;

    if (weatherLayerRef.current) {
      mapRef.current.removeLayer(weatherLayerRef.current);
      weatherLayerRef.current = null;
    }

    const weatherLayer = activeWmsLayers.find(l => {
      const def = WMS_LAYERS.find(d => d.value === l.value);
      return def && def.type === 'weather';
    });

    if (!weatherLayer) return;

    const opacity = weatherLayer.opacity || wmsOpacity;
    const layerDef = WMS_LAYERS.find(l => l.value === weatherLayer.value);
    if (!layerDef) return;

    const isPrecipitationLayer = layerDef.value === 'precipitation';

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
          const precip = point.precipitation || 0;
          const cloud = Math.round(point.cloudCover || 0);

          let icon;
          let color;
          let size;

          if (isPrecipitationLayer) {
            icon = getWeatherIcon('precipitation', precip, cloud);
            color = getPrecipitationColor(precip);
            size = getPrecipitationSize(precip);
          } else {
            icon = getWeatherIcon('temperature', precip, cloud);
            color = getColorForTemperature(point.temperature);
            size = 14;
          }

          const popupContent = `
            <strong>${icon} ${isPrecipitationLayer ? precip.toFixed(1) + ' mm' : temp + '°C'}</strong><br/>
            <b>Ressenti:</b> ${feelsLike}°C<br/>
            <b>Humidité:</b> ${humidity}%<br/>
            <b>Vent:</b> ${wind} km/h<br/>
            <b>Précipitations:</b> ${precip.toFixed(1)} mm<br/>
            <b>Couverture:</b> ${cloud}%<br/>
            <hr style="margin:4px 0;border:none;border-top:1px solid #eee;"/>
            <b>Coordonnées:</b><br/>
            Lat: ${point.latitude.toFixed(2)}, Lon: ${point.longitude.toFixed(2)}
          `;

          if (isPrecipitationLayer) {
            const weatherIcon = L.divIcon({
              html: `<div style="font-size:${size + 8}px;text-shadow:0 1px 4px rgba(0,0,0,0.5);">${icon}</div>`,
              className: 'weather-icon-marker',
              iconSize: [size + 12, size + 12],
              iconAnchor: [(size + 12) / 2, (size + 12) / 2],
            });

            const marker = L.marker([point.latitude, point.longitude], { 
              icon: weatherIcon,
              opacity: opacity,
              interactive: true,
            }).bindPopup(popupContent);

            weatherLayerRef.current.addLayer(marker);

            const label = L.marker([point.latitude, point.longitude], {
              icon: L.divIcon({
                html: `<div style="font-size:10px;font-weight:bold;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.7);text-align:center;margin-top:${size + 8}px;line-height:1.2;pointer-events:none;background:rgba(0,0,0,0.6);padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);">${precip.toFixed(1)}mm</div>`,
                className: 'weather-label',
                iconSize: [50, 18],
                iconAnchor: [25, 0],
              })
            });

            weatherLayerRef.current.addLayer(label);

          } else {
            const marker = L.circleMarker([point.latitude, point.longitude], {
              radius: size,
              fillColor: color,
              color: 'rgba(255,255,255,0.6)',
              weight: 2,
              opacity: opacity + 0.2,
              fillOpacity: opacity * 0.85,
            }).bindPopup(popupContent);

            weatherLayerRef.current.addLayer(marker);

            const label = L.marker([point.latitude, point.longitude], {
              icon: L.divIcon({
                html: `<div style="font-size:11px;font-weight:bold;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.8),0 0 8px rgba(0,0,0,0.6);text-align:center;margin-top:-${size + 14}px;line-height:1.2;pointer-events:none;">${temp}°</div>`,
                className: 'weather-label',
                iconSize: [34, 20],
                iconAnchor: [17, 10],
              })
            });

            weatherLayerRef.current.addLayer(marker);
            weatherLayerRef.current.addLayer(label);
          }
        });

        console.log(`🌦️ ${data.length} points météo affichés (${layerDef.value})`);

      } catch (error) {
        console.error('❌ Erreur chargement météo:', error);
        const fallbackData = getFallbackWeatherData();
        if (fallbackData && fallbackData.length > 0 && isMounted) {
          weatherLayerRef.current = L.layerGroup().addTo(mapRef.current);
          fallbackData.forEach(point => {
            const precip = point.precipitation || 0;
            const icon = isPrecipitationLayer 
              ? getWeatherIcon('precipitation', precip, 0)
              : getWeatherIcon('temperature', precip, 0);
            
            const marker = L.marker([point.latitude, point.longitude], {
              icon: L.divIcon({
                html: `<div style="font-size:20px;">${icon}</div>`,
                className: 'weather-icon-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              })
            }).bindPopup(`🌡️ Données simulées<br/>Précipitations: ${precip.toFixed(1)} mm`);
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
