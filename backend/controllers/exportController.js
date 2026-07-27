const fs = require('fs');
const path = require('path');

const EXPORTS_DIR = path.join(__dirname, '../exports');

// Créer le dossier exports s'il n'existe pas
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

exports.exportCSV = (req, res) => {
  try {
    const { data, filename = `fires_${new Date().toISOString().slice(0,10)}` } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à exporter' });
    }

    // Générer le CSV
    const headers = ['latitude', 'longitude', 'confidence', 'frp', 'acq_date', 'acq_time', 'type'];
    const rows = data.map(f => headers.map(h => f[h] || '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    // Sauvegarder sur le serveur
    const fullFilename = `${filename}.csv`;
    const filePath = path.join(EXPORTS_DIR, fullFilename);
    fs.writeFileSync(filePath, csv, 'utf8');

    res.json({
      success: true,
      filename: fullFilename,
      downloadUrl: `/exports/${fullFilename}`
    });

  } catch (error) {
    console.error('Erreur export CSV:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export CSV' });
  }
};

exports.exportGeoJSON = (req, res) => {
  try {
    const { data, filename = `fires_${new Date().toISOString().slice(0,10)}` } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à exporter' });
    }

    // Générer le GeoJSON
    const features = data.map(f => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [f.longitude, f.latitude]
      },
      properties: {
        confidence: f.confidence,
        frp: f.frp,
        acq_date: f.acq_date,
        acq_time: f.acq_time,
        type: f.type
      }
    }));

    const geojson = {
      type: 'FeatureCollection',
      features,
      metadata: {
        exportedAt: new Date().toISOString(),
        count: features.length
      }
    };

    // Sauvegarder sur le serveur
    const fullFilename = `${filename}.geojson`;
    const filePath = path.join(EXPORTS_DIR, fullFilename);
    fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2), 'utf8');

    res.json({
      success: true,
      filename: fullFilename,
      downloadUrl: `/exports/${fullFilename}`
    });

  } catch (error) {
    console.error('Erreur export GeoJSON:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export GeoJSON' });
  }
};

exports.listExports = (req, res) => {
  try {
    const files = fs.readdirSync(EXPORTS_DIR);
    const exports = files.map(file => ({
      filename: file,
      url: `/exports/${file}`,
      size: fs.statSync(path.join(EXPORTS_DIR, file)).size
    }));
    res.json({ exports });
  } catch (error) {
    console.error('Erreur listExports:', error);
    res.status(500).json({ error: 'Erreur lors de la liste des exports' });
  }
};
