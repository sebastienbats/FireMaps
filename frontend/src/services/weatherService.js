import axios from 'axios';

// Configuration pour les données météo
const WEATHER_CONFIG = {
  // Points clés en France métropolitaine
  points: [
    { lat: 48.8566, lon: 2.3522 }, // Paris
    { lat: 45.7640, lon: 4.8357 }, // Lyon
    { lat: 43.2965, lon: 5.3698 }, // Marseille
    { lat: 44.8378, lon: -0.5792 }, // Bordeaux
    { lat: 43.6047, lon: 1.4442 }, // Toulouse
    { lat: 48.5734, lon: 7.7521 }, // Strasbourg
    { lat: 47.2184, lon: -1.5536 }, // Nantes
    { lat: 50.6292, lon: 3.0573 }, // Lille
    { lat: 49.2604, lon: 4.0036 }, // Reims
    { lat: 49.2583, lon: -0.3694 }, // Caen
    { lat: 48.0922, lon: -1.6954 }, // Rennes
    { lat: 43.7103, lon: 7.2620 }, // Nice
    { lat: 47.9029, lon: 1.9086 }, // Orléans
    { lat: 49.1207, lon: 6.1774 }, // Metz
    { lat: 47.2378, lon: 6.0241 }, // Besançon
    { lat: 44.0182, lon: 0.5967 }, // Agen
    { lat: 49.4944, lon: 0.1071 }, // Le Havre
    { lat: 50.7258, lon: 1.6136 }, // Boulogne-sur-Mer
    { lat: 43.5843, lon: 3.0979 }, // Béziers
    { lat: 48.1364, lon: -1.6455 }, // Rennes
  ],
  timeout: 10000
};

let weatherCache = null;
let weatherCacheTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export const fetchWeatherData = async () => {
  // Vérifier le cache
  if (weatherCache && (Date.now() - weatherCacheTime) < CACHE_DURATION) {
    console.log('☁️ Utilisation des données météo en cache');
    return weatherCache;
  }

  try {
    console.log(`☁️ Récupération des données météo pour ${WEATHER_CONFIG.points.length} points...`);

    const results = [];
    for (let i = 0; i < WEATHER_CONFIG.points.length; i++) {
      const p = WEATHER_CONFIG.points[i];
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        const data = await fetchWeatherPoint(p.lat, p.lon);
        if (data) {
          results.push(data);
        }
      } catch (err) {
        console.warn(`⚠️ Erreur pour le point ${p.lat},${p.lon}:`, err.message);
      }
    }

    if (results.length === 0) {
      console.warn('⚠️ Aucune donnée météo récupérée, utilisation du fallback');
      return getFallbackWeatherData();
    }

    weatherCache = results;
    weatherCacheTime = Date.now();
    console.log(`☁️ Données météo chargées: ${results.length} points`);
    return results;

  } catch (error) {
    console.error('❌ Erreur fetchWeatherData:', error);
    return getFallbackWeatherData();
  }
};

const fetchWeatherPoint = async (lat, lon) => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&timezone=Europe/Paris`;

    const response = await axios.get(url, { timeout: WEATHER_CONFIG.timeout });

    if (!response.data || !response.data.current) {
      return null;
    }

    const current = response.data.current;
    return {
      latitude: lat,
      longitude: lon,
      temperature: current.temperature_2m || 0,
      humidity: current.relative_humidity_2m || 0,
      apparentTemperature: current.apparent_temperature || 0,
      precipitation: current.precipitation || 0,
      cloudCover: current.cloud_cover || 0,
      pressure: current.surface_pressure || 0,
      windSpeed: current.wind_speed_10m || 0,
      windDirection: current.wind_direction_10m || 0,
      time: current.time || new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`⚠️ Erreur pour ${lat},${lon}:`, error.message);
    return null;
  }
};

export const getFallbackWeatherData = () => {
  console.log('☁️ Utilisation des données météo de fallback');
  return WEATHER_CONFIG.points.map(p => ({
    latitude: p.lat,
    longitude: p.lon,
    temperature: 18 + Math.random() * 6 - 3,
    humidity: 60 + Math.random() * 20 - 10,
    apparentTemperature: 17 + Math.random() * 6 - 3,
    precipitation: Math.random() * 2,
    cloudCover: 30 + Math.random() * 40,
    pressure: 1010 + Math.random() * 10 - 5,
    windSpeed: 5 + Math.random() * 15,
    windDirection: Math.random() * 360,
    time: new Date().toISOString(),
  }));
};
