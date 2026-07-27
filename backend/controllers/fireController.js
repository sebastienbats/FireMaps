const fetch = require('node-fetch');

// Sources disponibles
const SOURCES = {
  MODIS_NRT: 'MODIS NRT',
  VIIRS_SNPP_NRT: 'VIIRS Suomi-NPP NRT',
  VIIRS_NOAA20_NRT: 'VIIRS NOAA-20 NRT',
  VIIRS_NOAA21_NRT: 'VIIRS NOAA-21 NRT',
  MODIS_SP: 'MODIS SP',
  VIIRS_SNPP_SP: 'VIIRS Suomi-NPP SP'
};

// Bounding box France métropolitaine (pour filtrer)
const FRANCE_BBOX = {
  west: -5.5,
  south: 41.2,
  east: 9.5,
  north: 51.5
};

// Configuration par défaut
const DEFAULT_CONFIG = {
  source: 'VIIRS_SNPP_NRT',
  days: 3,
  area: 'world',
  format: 'csv'
};

exports.getFires = async (req, res) => {
  try {
    const { 
      source = DEFAULT_CONFIG.source, 
      days = DEFAULT_CONFIG.days, 
      startDate, 
      endDate,
      apiKey
    } = req.query;
    
    // Utiliser la clé fournie ou celle du .env
    const mapKey = apiKey || process.env.FIRMS_MAP_KEY;
    
    if (!mapKey) {
      return res.status(401).json({ 
        error: 'Clé API FIRMS manquante. Veuillez la fournir dans les paramètres ou configurer .env' 
      });
    }

    // Vérifier la longueur de la clé
    console.log(`🔑 Clé API: ${mapKey.substring(0, 8)}... (${mapKey.length} caractères)`);

    // Construire l'URL avec le format qui fonctionne
    let url;
    let usedFormat = '';

    // Format 1: Avec date spécifique (si startDate est fourni)
    if (startDate) {
      url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/world/1/${startDate}`;
      usedFormat = 'CSV avec date (world)';
    } 
    // Format 2: Avec nombre de jours (par défaut)
    else {
      const effectiveDays = Math.min(Math.max(parseInt(days) || 3, 1), 5);
      url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/world/${effectiveDays}`;
      usedFormat = `CSV avec ${effectiveDays} jours (world)`;
    }

    console.log(`📡 Format utilisé: ${usedFormat}`);
    console.log(`🔗 URL: ${url.replace(mapKey, '***')}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erreur FIRMS (${response.status}):`, errorText);
      
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ 
          error: '❌ Clé API FIRMS invalide ou expirée',
          details: 'Vérifiez votre clé sur https://firms.modaps.eosdis.nasa.gov/mapkey/'
        });
      }
      
      if (response.status === 429) {
        return res.status(429).json({ 
          error: '⏳ Trop de requêtes vers l\'API FIRMS',
          details: 'Attendez 10 minutes avant de réessayer'
        });
      }
      
      return res.status(response.status).json({ 
        error: `Erreur FIRMS (${response.status}): ${errorText}` 
      });
    }

    // Le CSV est retourné en texte
    const csvText = await response.text();
    
    // Parser le CSV en JSON
    const allFires = parseCSVToJSON(csvText);
    
    console.log(`📊 ${allFires.length} feux récupérés dans le monde`);

    // Filtrer les feux pour ne garder que ceux en France métropolitaine
    const frenchFires = filterFiresByBbox(allFires, FRANCE_BBOX);
    
    console.log(`🇫🇷 ${frenchFires.length} feux en France métropolitaine`);

    // Filtrer par plage de dates si nécessaire
    let filteredFires = frenchFires;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      filteredFires = frenchFires.filter(f => {
        if (!f.acq_date) return false;
        const parts = f.acq_date.split('-');
        const date = new Date(parts[0], parts[1]-1, parts[2]);
        date.setHours(12, 0, 0, 0);
        return date >= start && date <= end;
      });
      
      console.log(`📅 ${filteredFires.length} feux dans la plage de dates`);
    }

    res.json({
      success: true,
      source,
      count: filteredFires.length,
      total_world: allFires.length,
      total_france: frenchFires.length,
      data: filteredFires,
      timestamp: new Date().toISOString(),
      url: url.replace(mapKey, '***'),
      format: usedFormat,
      area: 'world (filtré France)',
      bbox: FRANCE_BBOX
    });

  } catch (error) {
    console.error('❌ Erreur getFires:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données',
      details: error.message 
    });
  }
};

// Fonction pour parser le CSV en JSON
function parseCSVToJSON(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < headers.length) continue;

    const entry = {};
    headers.forEach((h, idx) => {
      entry[h] = values[idx] || '';
    });

    // Convertir les nombres
    const lat = parseFloat(entry.latitude);
    const lon = parseFloat(entry.longitude);
    if (isNaN(lat) || isNaN(lon)) continue;

    results.push({
      latitude: lat,
      longitude: lon,
      confidence: entry.confidence || '',
      frp: parseFloat(entry.frp) || 0,
      acq_date: entry.acq_date || '',
      acq_time: entry.acq_time || '',
      bright_ti4: parseFloat(entry.bright_ti4) || 0,
      bright_ti5: parseFloat(entry.bright_ti5) || 0,
      type: entry.type || '',
      scan: parseFloat(entry.scan) || 0,
      track: parseFloat(entry.track) || 0,
      satellite: entry.satellite || '',
      instrument: entry.instrument || '',
      version: entry.version || ''
    });
  }
  return results;
}

// Fonction pour filtrer les feux par bounding box
function filterFiresByBbox(fires, bbox) {
  const { west, south, east, north } = bbox;
  return fires.filter(fire => {
    const lat = fire.latitude;
    const lon = fire.longitude;
    return lat >= south && lat <= north && lon >= west && lon <= east;
  });
}

exports.getSources = (req, res) => {
  res.json({ sources: SOURCES });
};
