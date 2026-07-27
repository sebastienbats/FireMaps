import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
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

export const getFires = async (params) => {
  try {
    console.log('📡 Requête FIRMS avec params:', { ...params, apiKey: '***' });
    const response = await api.get('/fires', { params });
    console.log('✅ Réponse reçue:', response.data.count, 'feux');
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Clé API FIRMS invalide. Vérifiez votre clé dans les paramètres.');
    }
    if (error.response?.status === 403) {
      throw new Error('Clé API FIRMS expirée ou quota dépassé.');
    }
    throw new Error(error.response?.data?.error || 'Erreur lors de la récupération des feux');
  }
};

export const getSources = async () => {
  try {
    const response = await api.get('/fires/sources');
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Erreur lors de la récupération des sources');
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
    throw new Error(error.response?.data?.error || 'Erreur lors de la liste des exports');
  }
};
