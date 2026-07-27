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

// Bounding box France métropolitaine
const BBOX = {
  west: -5.5,
  south: 41.2,
  east: 9.5,
  north: 51.5
};

exports.getFires = async (req, res) => {
  try {
    const { 
      source = 'VIIRS_SNPP_NRT', 
      days = 1, 
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

    // Construire l'URL au format CSV avec date
    let url;
    
    if (startDate) {
      // Format avec date spécifique: /api/area/csv/{key}/{source}/{area}/{date}
      // Exemple: /api/area/csv/7427d7a5.../VIIRS_SNPP_NRT/world/1/2026-07-27
      const area = 'world'; // ou utiliser la bounding box
      const dateParam = startDate; // YYYY-MM-DD
      url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${area}/1/${dateParam}`;
    } else {
      // Format avec nombre de jours: /api/area/csv/{key}/{source}/{area}/{days}
      // Exemple: /api/area/csv/7427d7a5.../VIIRS_SNPP_NRT/world/3
      const effectiveDays = Math.min(Math.max(parseInt(days) || 1, 1), 5);
      const area = 'world'; // ou utiliser la bounding box
      url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${area}/${effectiveDays}`;
    }

    console.log(`📡 Requête FIRMS: ${source}`);
    console.log(`🔗 URL: ${url.replace(mapKey, '***')}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erreur FIRMS (${response.status}):`, errorText);
      
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ 
          error: 'Clé API FIRMS invalide ou expirée. Vérifiez votre clé sur firms.modaps.eosdis.nasa.gov' 
        });
      }
      
      return res.status(response.status).json({ 
        error: `Erreur FIRMS: ${errorText}` 
      });
    }

    // Le CSV est retourné en texte
    const csvText = await response.text();
    
    // Parser le CSV en JSON
    const fires = parseCSVToJSON(csvText);

    // Filtrer par date si nécessaire (déjà fait par l'API)
    let filteredFires = fires;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      filteredFires = fires.filter(f => {
        if (!f.acq_date) return false;
        const parts = f.acq_date.split('-');
        const date = new Date(parts[0], parts[1]-1, parts[2]);
        date.setHours(12, 0, 0, 0);
        return date >= start && date <= end;
      });
    }

    res.json({
      success: true,
      source,
      count: filteredFires.length,
      data: filteredFires,
      timestamp: new Date().toISOString(),
      url: url.replace(mapKey, '***')
    });

  } catch (error) {
    console.error('❌ Erreur getFires:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
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
      satellite: entry.satellite || ''
    });
  }
  return results;
}

exports.getSources = (req, res) => {
  res.json({ sources: SOURCES });
};
