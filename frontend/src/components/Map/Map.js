// === GESTION DES COUCHES GIBS WMS AVEC FALLBACK ===
useEffect(() => {
  if (!mapRef.current) return;

  const activeGibsValues = activeWmsLayers
    .filter(l => {
      const def = WMS_LAYERS.find(d => d.value === l.value);
      return def && def.type === 'gibs';
    })
    .map(l => l.value);

  console.log(`🔍 Couches GIBS actives: ${activeGibsValues.join(', ') || 'aucune'}`);

  // Supprimer les couches inactives
  Object.keys(wmsLayersRef.current).forEach(key => {
    if (!activeGibsValues.includes(key)) {
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
    if (!fullDef || fullDef.type !== 'gibs') return;

    const existingLayer = wmsLayersRef.current[layerDef.value];
    const opacity = layerDef.opacity || wmsOpacity;

    if (existingLayer) {
      existingLayer.setOpacity(opacity);
      return;
    }

    const gibsLayer = fullDef.layer;
    console.log(`🌿 Ajout de la couche GIBS: ${gibsLayer}`);

    // Configuration WMS de base
    const wmsOptions = {
      layers: gibsLayer,
      format: 'image/png',
      transparent: true,
      opacity: opacity,
      attribution: 'NASA GIBS',
      crs: L.CRS.EPSG4326,
      maxZoom: 10,
      minZoom: 3,
      tileSize: 512,
      zoomOffset: 0,
      version: '1.3.0',
      styles: fullDef.options?.styles || '',
      colorscalerange: '',  // Pour NDVI
    };

    // Gestion spécifique des dates
    if (gibsLayer === 'MOD13A2_NDVI') {
      // NDVI : utiliser plusieurs stratégies
      const now = new Date();
      
      // Stratégie 1: Plage de 30 jours
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      wmsOptions.time = `${startDate.toISOString().slice(0, 10)}/${now.toISOString().slice(0, 10)}`;
      
      // Essayer différents styles si palette/ndvi ne fonctionne pas
      // On va d'abord essayer sans style
      // wmsOptions.styles = ''; // Décommenter si nécessaire
      
      console.log(`📅 NDVI time range: ${wmsOptions.time}`);
    } else if (gibsLayer.includes('LST')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      wmsOptions.time = yesterday.toISOString().slice(0, 10);
      console.log(`📅 LST date: ${wmsOptions.time}`);
    }

    // Pour NDVI, essayer d'abord sans time si ça échoue
    // (certaines versions de GIBS acceptent mieux sans time)
    if (gibsLayer === 'MOD13A2_NDVI') {
      // On garde le time mais on ajoute un fallback
      console.log('🔄 NDVI: utilisation de time avec plage de 30 jours');
    }

    console.log(`📡 WMS Options:`, {
      layers: wmsOptions.layers,
      styles: wmsOptions.styles,
      time: wmsOptions.time || 'non spécifié',
      opacity: wmsOptions.opacity,
      crs: 'EPSG:4326'
    });

    try {
      const layer = L.tileLayer.wms(
        'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
        wmsOptions
      );

      layer.on('loading', () => console.log(`⏳ Chargement ${gibsLayer}...`));
      layer.on('load', () => console.log(`✅ ${gibsLayer} chargé`));
      layer.on('tileerror', (err) => {
        console.error(`❌ Erreur tuile ${gibsLayer}:`, err);
        // Tentative de fallback: retirer le paramètre time
        if (gibsLayer === 'MOD13A2_NDVI' && wmsOptions.time) {
          console.log('🔄 Fallback NDVI: tentative sans time...');
          const fallbackOptions = { ...wmsOptions };
          delete fallbackOptions.time;
          const fallbackLayer = L.tileLayer.wms(
            'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
            fallbackOptions
          ).addTo(mapRef.current);
          wmsLayersRef.current[layerDef.value] = fallbackLayer;
        }
      });

      layer.addTo(mapRef.current);
      wmsLayersRef.current[layerDef.value] = layer;
      console.log(`✅ Couche ${gibsLayer} ajoutée`);
    } catch (error) {
      console.error(`❌ Erreur ajout ${gibsLayer}:`, error);
    }
  });

  setTimeout(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, 1000);

  return () => {
    Object.values(wmsLayersRef.current).forEach(layer => {
      if (mapRef.current) mapRef.current.removeLayer(layer);
    });
    wmsLayersRef.current = {};
  };
}, [activeWmsLayers, wmsOpacity]);
