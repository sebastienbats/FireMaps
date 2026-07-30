# 🔥 FireMaps

Application web complète pour visualiser :
- les feux actifs (NASA FIRMS),
- les champs de vent (Open‑Meteo),
- la météo (couches WMS Open‑Meteo),
- la végétation (NDVI) et la température de surface (LST) via NASA GIBS,
- les casernes de pompiers (SDIS via data.gouv.fr).

## ✨ Fonctionnalités

- **Carte interactive** (Leaflet) avec marqueurs des feux (🔥).
- **Heatmap** des feux (intensité basée sur FRP).
- **Graphique temporel** (Chart.js) du nombre de feux par jour.
- **Alertes de concentration** (hotspots) : détection automatique des zones denses (>5 feux dans un rayon de ~10 km) avec affichage dans le panneau et cercles sur la carte.
- **Filtrage avancé** :
  - Confiance élevée
  - FRP > 50 MW
  - Période glissante (1–5 jours) OU plage de dates personnalisée
- **Sources satellites** : MODIS NRT/SP, VIIRS (Suomi‑NPP, NOAA‑20, NOAA‑21).
- **Export** des données filtrées en CSV et GeoJSON (sauvegarde sur le serveur).
- **Couche de vent** : prévisions ECMWF animées (Leaflet‑Velocity) avec fallback.
- **Couche WMS** : superposition de données géospatiales :
  - Météo (Open‑Meteo) : température, précipitations, couverture nuageuse.
  - Végétation (NDVI – NASA GIBS) : indice de végétation MODIS.
  - Température de surface (LST – NASA GIBS) : jour et nuit.
  - Réglage de l'opacité individuelle pour chaque couche.
- **Couche SDIS** : casernes de pompiers chargées depuis data.gouv.fr (plusieurs départements disponibles, ajout personnalisé possible).
- **Mode sombre** (toggle) avec persistance.
- **Design responsive** (React + CSS personnalisé).

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| **Frontend** | React 18, React Hooks, React Select, React Hot Toast, Chart.js, Axios |
| **Cartographie** | Leaflet, Leaflet.heat, Leaflet‑Velocity |
| **Backend** | Node.js, Express, CORS, dotenv, node‑fetch |
| **Données feux** | NASA FIRMS API (format CSV) |
| **Données vent/météo** | Open‑Meteo (ECMWF) |
| **Données NDVI/LST** | NASA GIBS (WMS) |
| **Données SDIS** | data.gouv.fr (GeoJSON) |

## 🚀 Installation

1. Clonez le dépôt.
   ```bash
   git clone https://github.com/sebastienbats/FireMaps-Leaflet.git
   cd FireMaps-Leaflet
   ```
2. Installation et exécution
   ```bash
   #Backend
   cd backend && npm install && npm start
   # ou en développement : npm run dev
   #Frontend
   cd frontend && npm install && npm start
   #Le frontend sera accessible sur http://localhost:3000 et le backend sur http://localhost:5000.
   ```  
3. Obtenez une clé API FIRMS gratuite sur [https://firms.modaps.eosdis.nasa.gov/mapkey/](https://firms.modaps.eosdis.nasa.gov/api/map_key).
4. Saisissez votre clé API, puis utilisez les boutons SDIS pour charger les casernes.

## 📦 Structure
```text
FireMaps-Leaflet/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── .env.example
│   ├── routes/
│   │   ├── fires.js
│   │   └── exports.js
│   └── controllers/
│       ├── fireController.js
│       └── exportController.js
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── index.css
        ├── App.js
        ├── App.css
        ├── components/
        │   ├── Map/
        │   │   ├── Map.js
        │   │   └── Map.css
        │   ├── Controls/
        │   │   ├── Controls.js
        │   │   └── Controls.css
        │   ├── Charts/
        │   │   ├── FireChart.js
        │   │   └── FireChart.css
        │   └── Alerts/
        │       ├── Alerts.js
        │       └── Alerts.css
        └── services/
            ├── api.js
            ├── weatherService.js
            └── windService.js
```
## 🔧 Personnalisation
   - Zone géographique : modifiez FRANCE_BBOX dans backend/controllers/fireController.js.
   - Sources satellites : ajustez l'objet SOURCES dans le même fichier.
   - Seuils des alertes : modifiez RADIUS_DEG et MIN_FIRES dans App.js (fonction detectHotspots).
   - Pas de la grille de vent : ajustez les points dans windService.js.
   - Liste des couches WMS : modifiez WMS_LAYERS dans Controls.js.

## 📋 API utilisées
   - NASA FIRMS : https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/world/{DAYS} ou .../world/1/{DATE}
   - Open‑Meteo (vent) : https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current=wind_speed_10m,wind_direction_10m
   - Open‑Meteo (météo) : https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current=temperature_2m,precipitation,...
   - NASA GIBS (WMS) : https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi avec les couches MOD13A2_NDVI, MOD11A1_LST_Day_1km, MOD11A1_LST_Night_1km
   - data.gouv.fr : URLs GeoJSON des SDIS départementaux.

## ⚠️ Limitations et bonnes pratiques

   - L'API FIRMS est limitée à 5 000 requêtes / 10 minutes.
   - Les données de vent sont des prévisions ECMWF échantillonnées.
   - Les données SDIS sont chargées depuis les URLs des départements ; leur disponibilité dépend des serveurs de data.gouv.fr.
   - Les couches WMS GIBS peuvent avoir un temps de chargement plus long selon le niveau de zoom.

## 📝 Licence

MIT – libre d'utilisation et de modification.
