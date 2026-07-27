import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './Map.css';

// Vérification robuste de la disponibilité de L.heatLayer
const isHeatLayerAvailable = () => {
  try {
    return typeof L !== 'undefined' && typeof L.heatLayer === 'function';
  } catch (e) {
    return false;
  }
};

const isVelocityLayerAvailable = () => {
  try {
    return typeof L !== 'undefined' && typeof L.velocityLayer === 'function';
  } catch (e) {
    return false;
  }
};

// Fonction pour charger dynamiquement leaflet.heat
const loadHeatPlugin = () => {
  return new Promise((resolve, reject) => {
    if (isHeatLayerAvailable()) {
      resolve();
      return;
    }
    
    console.log('📦 Tentative de chargement dynamique de leaflet.heat...');
    
    // Essayer plusieurs CDN
    const cdnUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js',
      'https://cdn.jsdelivr.net/npm/leaflet-heat@0.2.0/leaflet-heat.js',
      'https://unpkg.com/leaflet-heat@0.2.0/dist/leaflet-heat.js'
    ];
    
    let currentIndex = 0;
    
    const tryLoad = () => {
      if (currentIndex >= cdnUrls.length) {
        reject(new Error('Tous les CDN ont échoué'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = cdnUrls[currentIndex];
      script.async = true;
      
      script.onload = () => {
        if (isHeatLayerAvailable()) {
          console.log(`✅ leaflet.heat chargé depuis ${cdnUrls[currentIndex]}`);
          resolve();
        } else {
          currentIndex++;
          tryLoad();
        }
      };
      
      script.onerror = () => {
        console.warn(`⚠️ Échec du chargement depuis ${cdnUrls[currentIndex]}`);
        currentIndex++;
        tryLoad();
      };
      
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
  onWindToggle 
}) => {
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const heatmapRef = useRef(null);
  const alertRefs = useRef([]);
  const velocityRef = useRef(null);
  const heatLoadedRef = useRef(false);

  useEffect(() => {
    // Initialiser la carte
    if (!mapRef.current) {
      console.log('🗺️ Initialisation de la carte...');
      
      mapRef.current = L.map('map', {
        center: [46.6, 2.2],
        zoom: 6,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);

      markersRef.current = L.layerGroup().addTo(mapRef.current);
      
      console.log('✅ Carte initialisée');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Appliquer le dark mode
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 100);
    }
  }, [darkMode]);

  // Mettre à jour les marqueurs
  useEffect(() => {
    if (!markersRef.current || !mapRef.current) return;

    markersRef.current.clearLayers();

    if (fires && fires.length > 0) {
      console.log(`📍 Ajout de ${fires.length} marqueurs de feux`);
      
      const fireIcon = L.divIcon({
        html: '<div class="fire-marker">🔥</div>',
        className: 'fire-marker-container',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });

      fires.forEach(fire => {
        const popupContent = `
          <strong>🔥 Feu</strong><br/>
          <b>Lat:</b> ${fire.latitude.toFixed(4)}<br/>
          <b>Lon:</b> ${fire.longitude.toFixed(4)}<br/>
          <b>Confiance:</b> ${fire.confidence || 'N/A'}<br/>
          <b>FRP:</b> ${(fire.frp || 0).toFixed(1)} MW<br/>
          <b>Date:</b> ${fire.acq_date || 'N/A'}<br/>
          ${fire.type ? `<b>Type:</b> ${fire.type}` : ''}
        `;

        const marker = L.marker([fire.latitude, fire.longitude], { icon: fireIcon })
          .bindPopup(popupContent);
        markersRef.current.addLayer(marker);
      });

      // Ajuster la vue si c'est la première fois
      if (fires.length > 0 && !mapRef.current._initialized) {
        const bounds = L.latLngBounds(fires.map(f => [f.latitude, f.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
        mapRef.current._initialized = true;
      }
    }

    // Ajouter les alertes (cercles)
    alertRefs.current.forEach(circle => {
      if (mapRef.current) mapRef.current.removeLayer(circle);
    });
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

  // Mettre à jour la heatmap avec chargement automatique du plugin
  useEffect(() => {
    if (!mapRef.current) return;

    const updateHeatmap = async () => {
      // Supprimer l'ancienne heatmap
      if (heatmapRef.current) {
        mapRef.current.removeLayer(heatmapRef.current);
        heatmapRef.current = null;
      }

      if (!showHeatmap || !fires || fires.length === 0) {
        return;
      }

      // Vérifier si le plugin est disponible
      if (!isHeatLayerAvailable()) {
        console.warn('⚠️ L.heatLayer non disponible, tentative de chargement...');
        try {
          await loadHeatPlugin();
          heatLoadedRef.current = true;
        } catch (error) {
          console.error('❌ Échec du chargement de leaflet.heat:', error);
          return;
        }
      }

      // Vérifier à nouveau après le chargement
      if (isHeatLayerAvailable()) {
        console.log(`🔥 Création de la heatmap avec ${fires.length} points`);
        
        const points = fires.map(f => [f.latitude, f.longitude, f.frp || 1]);
        heatmapRef.current = L.heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 10,
          gradient: {
            0.4: 'blue',
            0.6: 'cyan',
            0.7: 'lime',
            0.8: 'yellow',
            1.0: 'red'
          }
        }).addTo(mapRef.current);
      } else {
        console.error('❌ L.heatLayer toujours non disponible après chargement');
      }
    };

    updateHeatmap();
  }, [showHeatmap, fires]);

  // Gérer la couche vent
  useEffect(() => {
    if (!mapRef.current) return;

    // Supprimer l'ancienne couche vent
    if (velocityRef.current) {
      mapRef.current.removeLayer(velocityRef.current);
      velocityRef.current = null;
    }

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
      if (onWindToggle) {
        onWindToggle(true);
      }
    }
  }, [showWind, windData, onWindToggle]);

  // Redimensionner la carte
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        setTimeout(() => mapRef.current.invalidateSize(), 100);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div id="map" className="map-container" />;
};

export default Map;
