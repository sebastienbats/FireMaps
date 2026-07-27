import axios from 'axios';

// Configuration pour les données vent
const WIND_CONFIG = {
  latMin: 41.2,
  latMax: 51.5,
  lonMin: -5.5,
  lonMax: 9.5,
  step: 1.0,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 5000 // 5 secondes entre les tentatives
};

// Cache pour éviter les requêtes répétées
let windCache = null;
let windCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchWindData = async () => {
  try {
    // Vérifier le cache
    if (windCache && (Date.now() - windCacheTime) < CACHE_DURATION) {
      console.log('🌬️ Utilisation des données vent en cache');
      return windCache;
    }

    console.log('🌬️ Récupération des données vent...');
    
    const { latMin, latMax, lonMin, lonMax, step } = WIND_CONFIG;
    
    // Générer la grille de points avec un pas plus grand
    const lats = [];
    const lons = [];
    for (let lat = latMin; lat <= latMax; lat += step) {
      lats.push(parseFloat(lat.toFixed(1)));
    }
    for (let lon = lonMin; lon <= lonMax; lon += step) {
      lons.push(parseFloat(lon.toFixed(1)));
    }

    // Vérifier que le nombre de points n'est pas trop grand
    const totalPoints = lats.length * lons.length;
    if (totalPoints > 200) {
      console.warn(`⚠️ Trop de points (${totalPoints}), réduction du pas...`);
      // Utiliser un pas plus grand
      const newStep = step + 0.5;
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
    // En cas d'erreur, retourner null au lieu de throw
    return null;
  }
};

// Fonction avec retry automatique
const fetchWindDataWithRetry = async (lats, lons, retryCount = 0) => {
  try {
    return await fetchWindDataWithParams(lats, lons);
  } catch (error) {
    if (error.response?.status === 429 && retryCount < WIND_CONFIG.maxRetries) {
      const delay = WIND_CONFIG.retryDelay * (retryCount + 1);
      console.log(`⏳ Rate limit atteint, nouvelle tentative dans ${delay/1000}s... (${retryCount + 1}/${WIND_CONFIG.maxRetries})`);
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
    
    // Construire l'URL Open-Meteo avec une grille réduite
    const latStr = lats.join(',');
    const lonStr = lons.join(',');
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&start_date=${dateStr}&end_date=${dateStr}`;
    
    console.log(`📊 Nombre de points: ${lats.length} x ${lons.length} = ${lats.length * lons.length}`);

    const response = await axios.get(url, { 
      timeout: WIND_CONFIG.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FireMap-App/1.0'
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
    const nx = lons.length;
    const ny = lats.length;
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
        lo1: parseFloat(lons[0]),
        lo2: parseFloat(lons[lons.length - 1]),
        la1: parseFloat(lats[0]),
        la2: parseFloat(lats[lats.length - 1]),
        dx: parseFloat((lons[1] - lons[0]).toFixed(1)),
        dy: parseFloat((lats[1] - lats[0]).toFixed(1)),
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
      console.error('❌ Erreur 400 - Requête mal formée. Réduction du nombre de points...');
      // Réduire encore le nombre de points
      const newStep = 2.0;
      const latMin = 41.2, latMax = 51.5, lonMin = -5.5, lonMax = 9.5;
      const newLats = [];
      const newLons = [];
      for (let lat = latMin; lat <= latMax; lat += newStep) {
        newLats.push(parseFloat(lat.toFixed(1)));
      }
      for (let lon = lonMin; lon <= lonMax; lon += newStep) {
        newLons.push(parseFloat(lon.toFixed(1)));
      }
      return await fetchWindDataWithParams(newLats, newLons);
    }
    throw error;
  }
};

// Fonction simple avec un seul point (fallback)
export const fetchWindDataSimple = async () => {
  try {
    console.log('🌬️ Récupération des données vent (mode simple)...');
    
    // Vérifier le cache pour le mode simple
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
    
    // Utiliser plusieurs points clés en France
    const points = [
      { lat: 44.8, lon: -0.6 }, // Bordeaux
      { lat: 48.9, lon: 2.3 },  // Paris
      { lat: 43.6, lon: 1.4 },  // Toulouse
      { lat: 47.2, lon: -1.6 }, // Nantes
      { lat: 45.8, lon: 4.8 },  // Lyon
      { lat: 43.3, lon: 5.4 },  // Marseille
      { lat: 48.6, lon: 7.7 },  // Strasbourg
      { lat: 50.6, lon: 3.1 },  // Lille
      { lat: 42.7, lon: 2.9 },  // Perpignan
      { lat: 44.0, lon: 6.2 }   // Nice
    ];
    
    // Récupérer les données pour chaque point avec un délai
    const allData = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      try {
        // Attendre entre chaque requête pour éviter le rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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
