import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 secondes
});

// Intercepteur pour ajouter la clé API à toutes les requêtes
api.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('firms_map_key');
    if (apiKey) {
      config.params = {
        ...config.params,
        apiKey: apiKey
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ Erreur 401 - Clé API invalide');
    }
    if (error.response?.status === 429) {
      console.error('⏳ Trop de requêtes - Attendez 10 minutes');
    }
    return Promise.reject(error);
  }
);

export const getFires = async (params) => {
  try {
    console.log('📡 Requête FIRMS:', params);
    const response = await api.get('/fires', { params });
    console.log(`✅ ${response.data.count} feux récupérés (format: ${response.data.format})`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('❌ Clé API FIRMS invalide ou expirée. Vérifiez votre clé sur firms.modaps.eosdis.nasa.gov');
    }
    if (error.response?.status === 429) {
      throw new Error('⏳ Trop de requêtes vers l\'API FIRMS. Attendez 10 minutes avant de réessayer.');
    }
    if (error.response?.status === 500) {
      throw new Error('⚠️ Erreur serveur. Veuillez réessayer plus tard.');
    }
    throw new Error(error.response?.data?.error || error.message || 'Erreur lors de la récupération des feux');
  }
};

export const getSources = async () => {
  try {
    const response = await api.get('/fires/sources');
    return response.data;
  } catch (error) {
    throw new Error('Erreur lors de la récupération des sources');
  }
};

export const exportCSV = async (data) => {
  try {
    const response = await api.post('/exports/csv', { data });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'export CSV');
  }
};

export const exportGeoJSON = async (data) => {
  try {
    const response = await api.post('/exports/geojson', { data });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'export GeoJSON');
  }
};

export const listExports = async () => {
  try {
    const response = await api.get('/exports/list');
    return response.data;
  } catch (error) {
    throw new Error('Erreur lors de la liste des exports');
  }
};
