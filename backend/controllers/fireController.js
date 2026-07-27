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
    const { source = 'VIIRS_SNPP_NRT', days = 3, startDate, endDate } = req.query;
    
    const mapKey = process.env.FIRMS_MAP_KEY;
    if (!mapKey) {
      return res.status(500).json({ error: 'Clé API FIRMS manquante' });
    }

    const effectiveDays = (startDate && endDate) ? 5 : Math.min(Math.max(parseInt(days) || 3, 1), 5);
    const area = `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/json/${mapKey}/${source}/${area}/${effectiveDays}`;

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Erreur FIRMS: ${error}` });
    }

    const data = await response.json();
    let fires = data.data || [];

    // Filtrage côté serveur (optionnel)
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      fires = fires.filter(f => {
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
      count: fires.length,
      data: fires,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur getFires:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
};

exports.getSources = (req, res) => {
  res.json({ sources: SOURCES });
};
