import axios from 'axios';

const WIND_CONFIG = {
  latMin: 41.2,
  latMax: 51.5,
  lonMin: -5.5,
  lonMax: 9.5,
  step: 2.0, // Augmenté pour réduire le nombre de points
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 5000
};

let windCache = null;
let windCacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const fetchWindData = async () => {
  // Vérifier le cache
  if (windCache && (Date.now() - windCacheTime) < CACHE_DURATION) {
    console.log('🌬️ Utilisation du cache vent');
    return windCache;
  }

  console.log('🌬️ Récupération des données vent...');
  const { latMin, latMax, lonMin, lonMax, step } = WIND_CONFIG;

  // Générer une grille plus petite
  const lats = [];
  const lons = [];
  for (let lat = latMin; lat <= latMax; lat += step) {
    lats.push(parseFloat(lat.toFixed(1)));
  }
  for (let lon = lonMin; lon <= lonMax; lon += step) {
    lons.push(parseFloat(lon.toFixed(1)));
  }

  const totalPoints = lats.length * lons.length;
  console.log(`📊 Grille: ${lats.length} x ${lons.length} = ${totalPoints} points`);

  // Si trop de points, utiliser le mode simple
  if (totalPoints > 30) {
    console.warn(`⚠️ Trop de points (${totalPoints}), utilisation du mode simple...`);
    return await fetchWindDataSimple();
  }

  // Récupérer les données point par point
  const allData = [];
  for (let i = 0; i < lats.length; i++) {
    for (let j = 0; j < lons.length; j++) {
      const lat = lats[i];
      const lon = lons[j];
      try {
        // Attendre entre chaque requête pour éviter le rate limiting
        if (allData.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        const data = await fetchWindPoint(lat, lon);
        if (data) {
          allData.push(data);
          console.log(`✅ Point ${allData.length}/${totalPoints}: ${lat},${lon}`);
        }
      } catch (err) {
        console.warn(`⚠️ Erreur pour le point ${lat},${lon}:`, err.message);
      }
    }
  }

  if (allData.length === 0) {
    console.warn('⚠️ Aucune donnée de vent récupérée, utilisation du fallback');
    return getFallbackWindData();
  }

  // Construire la grille à partir des données récupérées
  const windData = buildWindGrid(allData);
  if (windData) {
    windCache = windData;
    windCacheTime = Date.now();
    console.log(`🌬️ Données vent chargées: ${windData.header.nx}x${windData.header.ny} points`);
    return windData;
  }

  return getFallbackWindData();
};

// Récupérer les données pour un point unique
const fetchWindPoint = async (lat, lon) => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&forecast_days=1`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    if (!response.data || !response.data.hourly) {
      return null;
    }

    const u = response.data.hourly.wind_u_10m[0] || 0;
    const v = response.data.hourly.wind_v_10m[0] || 0;

    return {
      lat: lat,
      lon: lon,
      u: u,
      v: v
    };
  } catch (error) {
    console.warn(`⚠️ Erreur pour ${lat},${lon}:`, error.message);
    return null;
  }
};

// Construire une grille à partir des points récupérés
const buildWindGrid = (points) => {
  if (!points || points.length === 0) return null;

  const lats = [...new Set(points.map(p => p.lat))].sort();
  const lons = [...new Set(points.map(p => p.lon))].sort();

  const nx = lons.length;
  const ny = lats.length;
  const uGrid = [];
  const vGrid = [];

  for (let j = 0; j < ny; j++) {
    const rowU = [];
    const rowV = [];
    for (let i = 0; i < nx; i++) {
      const point = points.find(p => p.lat === lats[j] && p.lon === lons[i]);
      rowU.push(point ? point.u : 0);
      rowV.push(point ? point.v : 0);
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
};

// Mode simple avec des points clés
export const fetchWindDataSimple = async () => {
  console.log('🌬️ Récupération des données vent (mode simple)...');

  const cacheKey = 'wind_simple';
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && (Date.now() - data.timestamp) < CACHE_DURATION) {
        console.log('🌬️ Utilisation du cache simple');
        return data.data;
      }
    } catch (e) {}
  }

  // Points clés en France métropolitaine (grille plus large)
  const points = [
    { lat: 44.0, lon: -2.0 },
    { lat: 44.0, lon: 1.0 },
    { lat: 44.0, lon: 4.0 },
    { lat: 44.0, lon: 7.0 },
    { lat: 46.5, lon: -2.0 },
    { lat: 46.5, lon: 1.0 },
    { lat: 46.5, lon: 4.0 },
    { lat: 46.5, lon: 7.0 },
    { lat: 49.0, lon: -2.0 },
    { lat: 49.0, lon: 1.0 },
    { lat: 49.0, lon: 4.0 },
    { lat: 49.0, lon: 7.0 },
    { lat: 51.0, lon: 0.0 },
    { lat: 51.0, lon: 3.0 },
    { lat: 51.0, lon: 6.0 }
  ];

  const allData = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    try {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const data = await fetchWindPoint(p.lat, p.lon);
      if (data) {
        allData.push(data);
        console.log(`✅ Point ${i + 1}/${points.length}: ${p.lat},${p.lon}`);
      }
    } catch (err) {
      console.warn(`⚠️ Erreur pour le point ${p.lat},${p.lon}:`, err.message);
    }
  }

  if (allData.length === 0) {
    console.warn('⚠️ Aucune donnée récupérée, utilisation du fallback');
    return getFallbackWindData();
  }

  const windData = buildWindGrid(allData);
  if (windData) {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: windData
    }));
    console.log(`🌬️ Données vent simples chargées: ${windData.header.nx}x${windData.header.ny} points`);
    return windData;
  }

  return getFallbackWindData();
};

export const getFallbackWindData = () => {
  console.log('🌬️ Utilisation des données vent de fallback');

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
