import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { PacmanLoader } from 'react-spinners';
import './Controls.css';

// Liste des couches WMS disponibles
const WMS_LAYERS = [
  // --- Open-Meteo (tuiles météo) ---
  { value: 'temperature_2m', label: '🌡️ Température', type: 'open-meteo' },
  { value: 'precipitation', label: '🌧️ Précipitations', type: 'open-meteo' },
  { value: 'cloudcover', label: '☁️ Couverture nuageuse', type: 'open-meteo' },
  { value: 'pressure_msl', label: '📊 Pression', type: 'open-meteo' },
  { value: 'wind_speed_10m', label: '💨 Vitesse du vent', type: 'open-meteo' },
  { value: 'relative_humidity_2m', label: '💧 Humidité', type: 'open-meteo' },
  // --- NASA GIBS (WMS) ---
  { value: 'ndvi', label: '🌿 Végétation (NDVI)', type: 'gibs', layer: 'MOD13A2_NDVI' },
  { value: 'lst_day', label: '🌡️ LST (jour)', type: 'gibs', layer: 'MOD11A1_LST_Day_1km' },
  { value: 'lst_night', label: '🌡️ LST (nuit)', type: 'gibs', layer: 'MOD11A1_LST_Night_1km' },
];

// ... reste du composant inchangé ...
// (le code est identique à la version précédente)
