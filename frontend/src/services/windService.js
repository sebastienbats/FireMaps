import axios from 'axios';

// Configuration pour les données vent
const WIND_CONFIG = {
  latMin: 41.2,
  latMax: 51.5,
  lonMin: -5.5,
  lonMax: 9.5,
  step: 1.5, // Pas plus grand pour réduire le nombre de points
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 5000
};

// Cache pour éviter les requêtes répétées
let windCache = null;
let windCacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const fetchWindData = async () => {
  try {
    // Vérifier le cache
    if (windCache && (Date.now() - windCacheTime) < CACHE_DURATION) {
      console.log('🌬️ Utilisation des données vent en cache');
      return windCache;
    }

    console.log('🌬️ Récupération des données vent...');
    
    // Utiliser une grille plus petite pour éviter les erreurs 400
    const { latMin, latMax, lonMin, lonMax, step } = WIND_CONFIG;
    
    // Générer la grille de points
    const lats = [];
    const lons = [];
    for (let lat = latMin; lat <= latMax; lat += step) {
      lats.push(parseFloat(lat.toFixed(1)));
    }
    for (let lon = lonMin; lon <= lonMax; lon += step) {
      lons.push(parseFloat(lon.toFixed(1)));
    }

    const totalPoints = lats.length * lons.length;
    console.log(`📊 Nombre de points: ${lats.length} x ${lons.length} = ${totalPoints}`);

    // Si trop de points, réduire encore le pas
    if (totalPoints > 50) {
      console.warn(`⚠️ Trop de points (${totalPoints}), réduction...`);
      const newStep = 2.0;
      const newLats = [];
      const newLons = [];
      for (let lat = latMin; lat <= latMax; lat += newStep) {
        newLats.push(parseFloat(lat.toFixed(1)));
      }
      for (let lon = lonMin; lon <= lonMax; lon += newStep) {
        newLons.push(parseFloat(lon.toFixed(1)));
      }
      return await fetchWindDataWithRetry(newLats, newLons);
    }

    return await fetchWindDataWithRetry(lats, lons);

  } catch (error) {
    console.error('❌ Erreur fetchWindData:', error);
    // En cas d'erreur, essayer le mode simple
    return await fetchWindDataSimple();
  }
};

// Fonction avec retry automatique
const fetchWindDataWithRetry = async (lats, lons, retryCount = 0) => {
  try {
    return await fetchWindDataWithParams(lats, lons);
  } catch (error) {
    if (error.response?.status === 429 && retryCount < WIND_CONFIG.maxRetries) {
      const delay = WIND_CONFIG.retryDelay * (retryCount + 1);
      console.log(`⏳ Rate limit atteint, nouvelle tentative dans ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return await fetchWindDataWithRetry(lats, lons, retryCount + 1);
    }
    throw error;
  }
};

// Fonction pour récupérer les données avec des paramètres spécifiques
const fetchWindDataWithParams = async (lats, lons) => {
  try {
    // Date/heure actuelle + 1h (prévision)
    const now = new Date();
    const forecastHour = new Date(now.getTime() + 3600 * 1000);
    const dateStr = forecastHour.toISOString().slice(0, 10);
    
    // Construire l'URL Open-Meteo
    // Limiter le nombre de points pour éviter les erreurs 400
    const maxPoints = 20;
    let selectedLats = lats;
    let selectedLons = lons;
    
    if (lats.length * lons.length > maxPoints) {
      // Réduire le nombre de points
      const ratio = Math.sqrt(maxPoints / (lats.length * lons.length));
      const newStep = 1 / ratio;
      selectedLats = [];
      selectedLons = [];
      for (let i = 0; i < lats.length; i += Math.max(1, Math.round(1/ratio))) {
        selectedLats.push(lats[i]);
      }
      for (let i = 0; i < lons.length; i += Math.max(1, Math.round(1/ratio))) {
        selectedLons.push(lons[i]);
      }
    }
    
    const latStr = selectedLats.join(',');
    const lonStr = selectedLons.join(',');
    
    // Utiliser forecast_days=1 au lieu de start_date/end_date pour simplifier
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&forecast_days=1`;
    
    console.log(`📊 Points demandés: ${selectedLats.length} x ${selectedLons.length} = ${selectedLats.length * selectedLons.length}`);

    const response = await axios.get(url, { 
      timeout: WIND_CONFIG.timeout,
      headers: {
        'Accept': 'application/json'
        // User-Agent est automatiquement géré par le navigateur, on ne le modifie pas
      }
    });
    
    if (!response.data || !response.data.hourly) {
      throw new Error('Pas de données horaires dans la réponse');
    }

    const data = response.data;
    const times = data.hourly.time;
    const uData = data.hourly.wind_u_10m;
    const vData = data.hourly.wind_v_10m;

    if (!times || times.length === 0) {
      throw new Error('Aucune donnée temporelle reçue');
    }

    // Trouver l'index de l'heure souhaitée
    let targetIdx = 0;
    const nowTs = forecastHour.getTime();
    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i]);
      if (t.getTime() >= nowTs) {
        targetIdx = i;
        break;
      }
    }

    // Extraire les valeurs U et V pour cette heure
    const uValues = uData[targetIdx] || [];
    const vValues = vData[targetIdx] || [];

    // Réorganiser en tableau 2D
    const nx = selectedLons.length;
    const ny = selectedLats.length;
    const uGrid = [];
    const vGrid = [];

    for (let j = 0; j < ny; j++) {
      const rowU = [];
      const rowV = [];
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        rowU.push(uValues[idx] || 0);
        rowV.push(vValues[idx] || 0);
      }
      uGrid.push(rowU);
      vGrid.push(rowV);
    }

    // Construire l'objet pour Leaflet-Velocity
    const windData = {
      header: {
        nx: nx,
        ny: ny,
        lo1: parseFloat(selectedLons[0]),
        lo2: parseFloat(selectedLons[selectedLons.length - 1]),
        la1: parseFloat(selectedLats[0]),
        la2: parseFloat(selectedLats[selectedLats.length - 1]),
        dx: selectedLons.length > 1 ? parseFloat((selectedLons[1] - selectedLons[0]).toFixed(1)) : 0,
        dy: selectedLats.length > 1 ? parseFloat((selectedLats[1] - selectedLats[0]).toFixed(1)) : 0,
        parameterCategory: "wind",
        parameterNumber: "wind",
        refTime: new Date().toISOString()
      },
      data: {
        u: uGrid,
        v: vGrid
      }
    };

    // Mettre en cache
    windCache = windData;
    windCacheTime = Date.now();

    console.log(`🌬️ Données vent chargées: ${nx}x${ny} points`);
    return windData;

  } catch (error) {
    if (error.response?.status === 400) {
      console.error('❌ Erreur 400 - Requête mal formée. Utilisation du mode simple...');
      // Utiliser le mode simple en fallback
      return await fetchWindDataSimple();
    }
    throw error;
  }
};

// Fonction simple avec des points clés en France
export const fetchWindDataSimple = async () => {
  try {
    console.log('🌬️ Récupération des données vent (mode simple)...');
    
    // Vérifier le cache
    const cacheKey = 'wind_simple';
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data && (Date.now() - data.timestamp) < CACHE_DURATION) {
          console.log('🌬️ Utilisation des données vent simples en cache');
          return data.data;
        }
      } catch (e) {}
    }
    
    // Points clés en France métropolitaine (grille 3x3)
    const points = [
      { lat: 44.0, lon: -1.0 }, // Sud-Ouest
      { lat: 44.0, lon: 2.0 },  // Sud-Centre
      { lat: 44.0, lon: 5.0 },  // Sud-Est
      { lat: 47.0, lon: -1.0 }, // Ouest
      { lat: 47.0, lon: 2.0 },  // Centre
      { lat: 47.0, lon: 5.0 },  // Est
      { lat: 50.0, lon: -1.0 }, // Nord-Ouest
      { lat: 50.0, lon: 2.0 },  // Nord
      { lat: 50.0, lon: 5.0 }   // Nord-Est
    ];
    
    // Récupérer les données pour chaque point avec un délai
    const allData = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      try {
        // Attendre entre chaque requête pour éviter le rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&forecast_days=1`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data && response.data.hourly) {
          const u = response.data.hourly.wind_u_10m[0] || 0;
          const v = response.data.hourly.wind_v_10m[0] || 0;
          allData.push({
            lat: p.lat,
            lon: p.lon,
            u: u,
            v: v
          });
          console.log(`✅ Point ${i+1}/${points.length}: ${p.lat},${p.lon} -> u=${u.toFixed(1)}, v=${v.toFixed(1)}`);
        }
      } catch (err) {
        console.warn(`⚠️ Erreur pour le point ${p.lat},${p.lon}:`, err.message);
      }
    }

    if (allData.length === 0) {
      throw new Error('Aucune donnée de vent récupérée');
    }

    // Construire une grille à partir des points récupérés
    const lats = [...new Set(allData.map(d => d.lat))].sort();
    const lons = [...new Set(allData.map(d => d.lon))].sort();
    
    const nx = lons.length;
    const ny = lats.length;
    const uGrid = [];
    const vGrid = [];

    for (let j = 0; j < ny; j++) {
      const rowU = [];
      const rowV = [];
      for (let i = 0; i < nx; i++) {
        const point = allData.find(d => d.lat === lats[j] && d.lon === lons[i]);
        rowU.push(point ? point.u : 0);
        rowV.push(point ? point.v : 0);
      }
      uGrid.push(rowU);
      vGrid.push(rowV);
    }

    const windData = {
      header: {
        nx: nx,
        ny: ny,
        lo1: lons[0],
        lo2: lons[lons.length - 1],
        la1: lats[0],
        la2: lats[lats.length - 1],
        dx: lons.length > 1 ? parseFloat((lons[1] - lons[0]).toFixed(1)) : 0,
        dy: lats.length > 1 ? parseFloat((lats[1] - lats[0]).toFixed(1)) : 0,
        parameterCategory: "wind",
        parameterNumber: "wind",
        refTime: new Date().toISOString()
      },
      data: {
        u: uGrid,
        v: vGrid
      }
    };

    // Mettre en cache
    sessionStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: windData
    }));

    console.log(`🌬️ Données vent simples chargées: ${nx}x${ny} points`);
    return windData;

  } catch (error) {
    console.error('❌ Erreur fetchWindDataSimple:', error);
    return null;
  }
};

// Fonction de fallback avec des données simulées (si tout échoue)
export const getFallbackWindData = () => {
  console.log('🌬️ Utilisation des données vent de fallback');
  
  // Créer une grille 5x5 avec des vents simulés
  const lats = [42, 44, 46, 48, 50];
  const lons = [-4, -2, 0, 2, 4, 6, 8];
  
  const nx = lons.length;
  const ny = lats.length;
  const uGrid = [];
  const vGrid = [];

  for (let j = 0; j < ny; j++) {
    const rowU = [];
    const rowV = [];
    for (let i = 0; i < nx; i++) {
      // Simuler des vents avec des variations
      const u = 5 * Math.sin(i * 0.5 + j * 0.3) + 2 * Math.cos(i * 0.7 - j * 0.4);
      const v = 3 * Math.cos(i * 0.4 + j * 0.6) + 4 * Math.sin(i * 0.3 - j * 0.5);
      rowU.push(u);
      rowV.push(v);
    }
    uGrid.push(rowU);
    vGrid.push(rowV);
  }

  return {
    header: {
      nx: nx,
      ny: ny,
      lo1: lons[0],
      lo2: lons[lons.length - 1],
      la1: lats[0],
      la2: lats[lats.length - 1],
      dx: lons[1] - lons[0],
      dy: lats[1] - lats[0],
      parameterCategory: "wind",
      parameterNumber: "wind",
      refTime: new Date().toISOString()
    },
    data: {
      u: uGrid,
      v: vGrid
    }
  };
};
