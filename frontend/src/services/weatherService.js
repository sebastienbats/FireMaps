import axios from 'axios';

// Configuration pour les données météo
const WEATHER_CONFIG = {
  // Grille de points en France métropolitaine
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
    { lat: 44.8392, lon: -0.5749 }, // Bordeaux (déjà)
    { lat: 43.7103, lon: 7.2620 }, // Nice
    { lat: 47.9029, lon: 1.9086 }, // Orléans
    { lat: 49.1207, lon: 6.1774 }, // Metz
    { lat: 47.2378, lon: 6.0241 }, // Besançon
    { lat: 44.0182, lon: 0.5967 }, // Agen
    { lat: 49.4944, lon: 0.1071 }, // Le Havre
    { lat: 50.7258, lon: 1.6136 }, // Boulogne-sur-Mer
    { lat: 43.5843, lon: 3.0979 }, // Béziers
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
    console.log('☁️ Récupération des données météo pour', WEATHER_CONFIG.points.length, 'points...');

    // Récupérer les données pour tous les points
    const weatherData = await fetchWeatherForPoints(WEATHER_CONFIG.points);

    // Mettre en cache
    weatherCache = weatherData;
    weatherCacheTime = Date.now();

    console.log(`☁️ Données météo chargées: ${weatherData.length} points`);
    return weatherData;

  } catch (error) {
    console.error('❌ Erreur fetchWeatherData:', error);
    // Retourner des données de fallback
    return getFallbackWeatherData();
  }
};

const fetchWeatherForPoints = async (points) => {
  const results = [];
  const batchSize = 10; // Nombre de points par requête (limite API)

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    const lats = batch.map(p => p.lat).join(',');
    const lons = batch.map(p => p.lon).join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&timezone=Europe/Paris`;

    try {
      const response = await axios.get(url, { timeout: WEATHER_CONFIG.timeout });

      if (response.data && response.data.current) {
        // La réponse peut être un tableau si plusieurs points
        const currentData = response.data.current;
        const timestamps = currentData.time || [];

        // Si les données sont sous forme de tableau (multiple points)
        if (Array.isArray(currentData.temperature_2m)) {
          for (let j = 0; j < currentData.temperature_2m.length; j++) {
            results.push({
              latitude: parseFloat(batch[j].lat),
              longitude: parseFloat(batch[j].lon),
              temperature: currentData.temperature_2m[j],
              humidity: currentData.relative_humidity_2m?.[j],
              apparentTemperature: currentData.apparent_temperature?.[j],
              precipitation: currentData.precipitation?.[j],
              cloudCover: currentData.cloud_cover?.[j],
              pressure: currentData.surface_pressure?.[j],
              windSpeed: currentData.wind_speed_10m?.[j],
              windDirection: currentData.wind_direction_10m?.[j],
              time: timestamps[j] || new Date().toISOString(),
            });
          }
        } else {
          // Données pour un seul point
          results.push({
            latitude: parseFloat(batch[0].lat),
            longitude: parseFloat(batch[0].lon),
            temperature: currentData.temperature_2m,
            humidity: currentData.relative_humidity_2m,
            apparentTemperature: currentData.apparent_temperature,
            precipitation: currentData.precipitation,
            cloudCover: currentData.cloud_cover,
            pressure: currentData.surface_pressure,
            windSpeed: currentData.wind_speed_10m,
            windDirection: currentData.wind_direction_10m,
            time: currentData.time || new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn(`⚠️ Erreur pour le batch ${i}:`, err.message);
      // Ajouter des données de fallback pour ce batch
      for (const p of batch) {
        results.push({
          latitude: p.lat,
          longitude: p.lon,
          temperature: 18,
          humidity: 65,
          apparentTemperature: 17,
          precipitation: 0,
          cloudCover: 30,
          pressure: 1015,
          windSpeed: 10,
          windDirection: 180,
          time: new Date().toISOString(),
        });
      }
    }
  }

  return results;
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
