import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity
});

api.interceptors.request.use(
  (config) => {
    const key = localStorage.getItem('firms_map_key');
    if (key) config.params = { ...config.params, apiKey: key };
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 413) console.error('❌ Erreur 413 - Payload too large');
    if (error.response?.status === 401) console.error('❌ Erreur 401 - Clé API invalide');
    if (error.response?.status === 429) console.error('⏳ Trop de requêtes - Attendez 10 min');
    return Promise.reject(error);
  }
);

export const getFires = async (params) => {
  try {
    const response = await api.get('/fires', { params });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) throw new Error('❌ Clé API invalide ou expirée.');
    if (error.response?.status === 429) throw new Error('⏳ Trop de requêtes. Attendez 10 min.');
    if (error.response?.status === 413) throw new Error('⚠️ Données trop volumineuses. Utilisez les filtres.');
    throw new Error(error.response?.data?.error || 'Erreur lors de la récupération des feux');
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
    if (error.response?.status === 413) throw new Error('⚠️ Trop de données à exporter. Utilisez les filtres.');
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'export CSV');
  }
};

export const exportGeoJSON = async (data) => {
  try {
    const response = await api.post('/exports/geojson', { data });
    return response.data;
  } catch (error) {
    if (error.response?.status === 413) throw new Error('⚠️ Trop de données à exporter. Utilisez les filtres.');
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

export const deleteExport = async (filename) => {
  try {
    const response = await api.delete(`/exports/${filename}`);
    return response.data;
  } catch (error) {
    throw new Error('Erreur lors de la suppression');
  }
};
