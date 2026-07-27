import axios from 'axios';

// Configuration pour les données vent
const WIND_CONFIG = {
  latMin: 41.2,
  latMax: 51.5,
  lonMin: -5.5,
  lonMax: 9.5,
  step: 0.5
};

export const fetchWindData = async () => {
  try {
    console.log('🌬️ Récupération des données vent...');
    
    const { latMin, latMax, lonMin, lonMax, step } = WIND_CONFIG;
    
    // Générer la grille de points
    const lats = [];
    const lons = [];
    for (let lat = latMin; lat <= latMax; lat += step) {
      lats.push(parseFloat(lat.toFixed(2)));
    }
    for (let lon = lonMin; lon <= lonMax; lon += step) {
      lons.push(parseFloat(lon.toFixed(2)));
    }

    // Date/heure actuelle + 1h (prévision)
    const now = new Date();
    const forecastHour = new Date(now.getTime() + 3600 * 1000);
    const dateStr = forecastHour.toISOString().slice(0, 10);
    
    // Construire l'URL Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&start_date=${dateStr}&end_date=${dateStr}`;
    
    console.log(`🌬️ URL: ${url}`);
    
    const response = await axios.get(url, { timeout: 30000 });
    
    if (!response.data) {
      throw new Error('Pas de données reçues');
    }

    const data = response.data;
    const times = data.hourly.time;
    const uData = data.hourly.wind_u_10m;
    const vData = data.hourly.wind_v_10m;

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
        lo1: lonMin,
        lo2: lonMax,
        la1: latMin,
        la2: latMax,
        dx: step,
        dy: step,
        parameterCategory: "wind",
        parameterNumber: "wind",
        refTime: new Date().toISOString()
      },
      data: {
        u: uGrid,
        v: vGrid
      }
    };

    console.log(`🌬️ Données vent chargées: ${nx}x${ny} points`);
    return windData;

  } catch (error) {
    console.error('❌ Erreur fetchWindData:', error);
    throw new Error('Erreur lors du chargement des données vent: ' + error.message);
  }
};
