import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getFires = async (params) => {
  try {
    const response = await api.get('/fires', { params });
    return response.data;
  } catch (error) {
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
