# 🔥 FireMaps

Application web complète pour visualiser :
- les feux actifs (NASA FIRMS)
- les champs de vent (Open-Meteo / ECMWF)
- les casernes de pompiers (SDIS) via data.gouv.fr

## ✨ Fonctionnalités

- **Carte interactive** (Leaflet) avec marqueurs des feux, casernes et vent.
- **Heatmap** dynamique des feux (intensité FRP).
- **Graphique temporel** (Chart.js) du nombre de feux par jour.
- **Alertes de concentration** (hotspots) : détection automatique des zones denses.
- **Filtrage avancé** : confiance, FRP, période personnalisée.
- **Sources satellites** : MODIS NRT/SP, VIIRS (Suomi-NPP, NOAA-20, NOAA-21).
- **Export** des données filtrées en CSV et GeoJSON.
- **Couches WMS** : végétation (NDVI), température de surface (LST).
- **Couche de vent** : prévisions ECMWF à 0.25° animées (Leaflet-Velocity).
- **Couche SDIS** : casernes de pompiers chargées depuis data.gouv.fr (plusieurs départements disponibles, ajout personnalisé possible).
- **Mode sombre** (toggle) avec persistance.
- **Design responsive** (Tailwind CSS + Alpine.js).

## 🛠️ Stack technique

- **UI** : Tailwind CSS + Alpine.js
- **Cartographie** : Leaflet + plugins (heat, velocity)
- **Graphique** : Chart.js
- **Export** : FileSaver.js
- **Données feux** : NASA FIRMS (API JSON)
- **Données vent** : Open-Meteo (ECMWF)
- **Données SDIS** : data.gouv.fr (GeoJSON)

## 🚀 Installation

1. Clonez le dépôt.
   ```bash
   git clone https://github.com/sebastienbats/FireMaps.git
   cd FireMaps
   ```
3. Obtenez une clé API FIRMS gratuite sur [https://firms.modaps.eosdis.nasa.gov/mapkey/](https://firms.modaps.eosdis.nasa.gov/api/map_key).
4. Ouvrez `index.html` dans votre navigateur.
5. Saisissez votre clé API, puis utilisez les boutons SDIS pour charger les casernes.

## 📦 Structure

- `index.html` : fichier unique (HTML + CSS + JS)
- `README.md` : documentation

## 🔧 Personnalisation SDIS

- **Ajouter un département** : modifiez l'objet `sdisPresets` dans `app()`.
- **Utiliser votre propre URL** : entrez l'URL d'un jeu de données GeoJSON dans le champ prévu.

## ⚠️ Limitations

- L'API FIRMS est limitée à 5 000 requêtes / 10 min.
- Les données SDIS sont chargées directement depuis les URLs des départements ; leur disponibilité dépend des serveurs de data.gouv.fr.

## 📝 Licence

MIT – libre d'utilisation et de modification.
