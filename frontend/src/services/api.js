import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configuration avec timeout plus long pour les gros exports
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000, // 60 secondes
  maxBodyLength: Infinity, // Pas de limite de taille pour le body
  maxContentLength: Infinity // Pas de limite de taille pour la réponse
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
    if (error.response?.status === 413) {
      console.error('❌ Erreur 413 - Payload too large');
    }
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
    console.log(`✅ ${response.data.count} feux récupérés`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('❌ Clé API FIRMS invalide ou expirée.');
    }
    if (error.response?.status === 429) {
      throw new Error('⏳ Trop de requêtes. Attendez 10 minutes.');
    }
    if (error.response?.status === 413) {
      throw new Error('⚠️ Les données sont trop volumineuses. Utilisez les filtres pour réduire le nombre de feux.');
    }
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
    console.log(`📤 Export CSV: ${data.length} lignes`);
    const response = await api.post('/exports/csv', { data });
    console.log(`✅ CSV exporté: ${response.data.filename}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 413) {
      throw new Error('⚠️ Trop de données à exporter. Utilisez les filtres pour réduire le nombre de feux.');
    }
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'export CSV');
  }
};

export const exportGeoJSON = async (data) => {
  try {
    console.log(`📤 Export GeoJSON: ${data.length} points`);
    const response = await api.post('/exports/geojson', { data });
    console.log(`✅ GeoJSON exporté: ${response.data.filename}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 413) {
      throw new Error('⚠️ Trop de données à exporter. Utilisez les filtres pour réduire le nombre de feux.');
    }
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
