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
      days = 3, 
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
    console.log(`🔑 Longueur de la clé: ${mapKey.length} caractères`);
    console.log(`🔑 Début de la clé: ${mapKey.substring(0, 8)}...`);

    // Essayer différents formats d'URL
    let url;
    let usedFormat = '';

    // Format 1: Avec date (si startDate est fourni)
    if (startDate) {
      // Essayer avec bounding box France
      const area = `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`;
      url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${area}/1/${startDate}`;
      usedFormat = 'CSV avec date et bbox';
    } 
    // Format 2: Sans date, avec jours
    else {
      const effectiveDays = Math.min(Math.max(parseInt(days) || 3, 1), 5);
      
      // Essayer avec bounding box France
      const area = `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`;
      url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${area}/${effectiveDays}`;
      usedFormat = 'CSV avec jours et bbox';
    }

    console.log(`📡 Format utilisé: ${usedFormat}`);
    console.log(`🔗 URL: ${url.replace(mapKey, '***')}`);

    const response = await fetch(url);
    
    // Si la requête échoue avec bbox, essayer avec 'world'
    if (response.status === 400 || response.status === 401) {
      console.log('⚠️ Requête avec bbox échouée, tentative avec "world"...');
      
      let fallbackUrl;
      if (startDate) {
        fallbackUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/world/1/${startDate}`;
      } else {
        const effectiveDays = Math.min(Math.max(parseInt(days) || 3, 1), 5);
        fallbackUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/world/${effectiveDays}`;
      }
      
      console.log(`🔗 Fallback URL: ${fallbackUrl.replace(mapKey, '***')}`);
      
      const fallbackResponse = await fetch(fallbackUrl);
      
      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        console.error(`❌ Erreur FIRMS (${fallbackResponse.status}):`, errorText);
        
        if (fallbackResponse.status === 401 || fallbackResponse.status === 403) {
          return res.status(401).json({ 
            error: 'Clé API FIRMS invalide ou expirée. Vérifiez que vous utilisez une clé valide sur firms.modaps.eosdis.nasa.gov',
            details: 'La clé doit être activée pour l\'API FIRMS. Obtenez une nouvelle clé si nécessaire.'
          });
        }
        
        return res.status(fallbackResponse.status).json({ 
          error: `Erreur FIRMS: ${errorText}` 
        });
      }
      
      // Utiliser la réponse fallback
      const csvText = await fallbackResponse.text();
      const fires = parseCSVToJSON(csvText);
      
      return res.json({
        success: true,
        source,
        count: fires.length,
        data: fires,
        timestamp: new Date().toISOString(),
        url: fallbackUrl.replace(mapKey, '***'),
        format: 'CSV with world area (fallback)'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erreur FIRMS (${response.status}):`, errorText);
      
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ 
          error: 'Clé API FIRMS invalide ou expirée. Vérifiez votre clé sur firms.modaps.eosdis.nasa.gov',
          details: 'La clé doit être activée pour l\'API FIRMS.'
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

    // Filtrer par date si nécessaire
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
      url: url.replace(mapKey, '***'),
      format: usedFormat
    });

  } catch (error) {
    console.error('❌ Erreur getFires:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données: ' + error.message });
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
