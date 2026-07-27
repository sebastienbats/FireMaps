import axios from 'axios';

// Configuration pour les données vent - Grille plus petite
const WIND_CONFIG = {
  latMin: 41.2,
  latMax: 51.5,
  lonMin: -5.5,
  lonMax: 9.5,
  step: 1.0, // Augmenté de 0.5 à 1.0 pour réduire le nombre de points
  timeout: 30000
};

export const fetchWindData = async () => {
  try {
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
    if (lats.length * lons.length > 500) {
      console.warn(`⚠️ Trop de points (${lats.length * lons.length}), réduction du pas...`);
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
      return fetchWindDataWithParams(newLats, newLons);
    }

    return await fetchWindDataWithParams(lats, lons);

  } catch (error) {
    console.error('❌ Erreur fetchWindData:', error);
    throw new Error('Erreur lors du chargement des données vent: ' + error.message);
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
    
    // Utiliser une résolution plus basse pour réduire la taille
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&start_date=${dateStr}&end_date=${dateStr}`;
    
    console.log(`🌬️ URL: ${url.substring(0, 200)}...`); // Log tronqué pour éviter de surcharger
    console.log(`📊 Nombre de points: ${lats.length} x ${lons.length} = ${lats.length * lons.length}`);

    const response = await axios.get(url, { 
      timeout: WIND_CONFIG.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.data) {
      throw new Error('Pas de données reçues');
    }

    if (!response.data.hourly) {
      console.warn('⚠️ Pas de données horaires dans la réponse');
      return null;
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

    console.log(`🌬️ Données vent chargées: ${nx}x${ny} points`);
    return windData;

  } catch (error) {
    if (error.response?.status === 400) {
      console.error('❌ Erreur 400 - Requête mal formée. Tentative avec une grille plus petite...');
      // Réessayer avec un pas plus grand
      const newStep = 1.5;
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

// Fonction alternative utilisant l'API avec un point unique pour test
export const fetchWindDataSimple = async () => {
  try {
    console.log('🌬️ Récupération des données vent (mode simple)...');
    
    // Utiliser un seul point (centre de la France)
    const lat = 46.6;
    const lon = 2.2;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_u_10m,wind_v_10m&timezone=Europe/Paris&forecast_days=1`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data || !response.data.hourly) {
      throw new Error('Pas de données reçues');
    }

    const data = response.data;
    const times = data.hourly.time;
    const uData = data.hourly.wind_u_10m;
    const vData = data.hourly.wind_v_10m;

    // Construire une grille 1x1 pour tester
    const windData = {
      header: {
        nx: 1,
        ny: 1,
        lo1: lon,
        lo2: lon,
        la1: lat,
        la2: lat,
        dx: 0,
        dy: 0,
        parameterCategory: "wind",
        parameterNumber: "wind",
        refTime: new Date().toISOString()
      },
      data: {
        u: [[uData[0] || 0]],
        v: [[vData[0] || 0]]
      }
    };

    console.log('🌬️ Données vent simples chargées');
    return windData;

  } catch (error) {
    console.error('❌ Erreur fetchWindDataSimple:', error);
    throw new Error('Erreur lors du chargement des données vent: ' + error.message);
  }
};
