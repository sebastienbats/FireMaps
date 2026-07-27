import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Vérification de Leaflet avant de lancer l'application
console.log('🔍 Vérification de l\'environnement...');

// S'assurer que Leaflet est chargé
if (typeof L === 'undefined') {
  console.warn('⚠️ Leaflet non chargé, chargement depuis CDN...');
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = () => {
    console.log('✅ Leaflet chargé');
  };
  document.head.appendChild(script);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
