import axios from 'axios';

const WIND_CONFIG = {
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

  // Points clés en France métropolitaine
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

// Récupérer les données pour un point unique avec l'API current
const fetchWindPoint = async (lat, lon) => {
  try {
    // Utiliser current au lieu de hourly
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Europe/Paris`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    if (!response.data || !response.data.current) {
      return null;
    }

    const current = response.data.current;
    // Convertir vitesse et direction en composantes U et V
    const speed = current.wind_speed_10m || 0;
    const direction = current.wind_direction_10m || 0;
    
    // Convertir direction météo (0° = Nord, 90° = Est) en angle mathématique
    const angleRad = (direction - 180) * Math.PI / 180;
    const u = speed * Math.cos(angleRad);
    const v = speed * Math.sin(angleRad);

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
