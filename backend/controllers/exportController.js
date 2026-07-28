const fs = require('fs');
const path = require('path');

const EXPORTS_DIR = path.join(__dirname, '../exports');
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

function generateFilename(prefix = 'fires') {
  const date = new Date().toISOString().slice(0, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}_${date}_${timestamp}`;
}

exports.exportCSV = (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à exporter' });
    }
    console.log(`📊 Export CSV: ${data.length} lignes`);

    const headers = ['latitude', 'longitude', 'confidence', 'frp', 'acq_date', 'acq_time', 'type'];
    let csv = headers.join(',') + '\n';
    for (const f of data) {
      const row = headers.map(h => {
        const val = f[h] || '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csv += row.join(',') + '\n';
    }

    const base = filename || generateFilename('fires');
    const full = `${base}.csv`;
    const filePath = path.join(EXPORTS_DIR, full);
    fs.writeFileSync(filePath, csv, 'utf8');
    const size = fs.statSync(filePath).size;
    console.log(`✅ CSV exporté: ${full} (${(size/1024).toFixed(1)} KB)`);

    res.json({ success: true, filename: full, downloadUrl: `/exports/${full}`, size, count: data.length });
  } catch (error) {
    console.error('❌ Erreur export CSV:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export CSV: ' + error.message });
  }
};

exports.exportGeoJSON = (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à exporter' });
    }
    console.log(`📊 Export GeoJSON: ${data.length} points`);

    const features = data.map(f => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
      properties: {
        confidence: f.confidence || '',
        frp: f.frp || 0,
        acq_date: f.acq_date || '',
        acq_time: f.acq_time || '',
        type: f.type || ''
      }
    }));

    const geojson = {
      type: 'FeatureCollection',
      features,
      metadata: { exportedAt: new Date().toISOString(), count: features.length, source: 'NASA FIRMS' }
    };

    const base = filename || generateFilename('fires');
    const full = `${base}.geojson`;
    const filePath = path.join(EXPORTS_DIR, full);
    fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2), 'utf8');
    const size = fs.statSync(filePath).size;
    console.log(`✅ GeoJSON exporté: ${full} (${(size/1024).toFixed(1)} KB)`);

    res.json({ success: true, filename: full, downloadUrl: `/exports/${full}`, size, count: data.length });
  } catch (error) {
    console.error('❌ Erreur export GeoJSON:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export GeoJSON: ' + error.message });
  }
};

exports.listExports = (req, res) => {
  try {
    const files = fs.readdirSync(EXPORTS_DIR);
    const exports = files
      .filter(f => f.endsWith('.csv') || f.endsWith('.geojson'))
      .map(f => {
        const stats = fs.statSync(path.join(EXPORTS_DIR, f));
        return { filename: f, url: `/exports/${f}`, size: stats.size, sizeFormatted: (stats.size/1024).toFixed(1)+' KB', modified: stats.mtime };
      })
      .sort((a,b) => b.modified - a.modified);
    res.json({ exports, count: exports.length });
  } catch (error) {
    console.error('❌ Erreur listExports:', error);
    res.status(500).json({ error: 'Erreur lors de la liste des exports' });
  }
};

exports.deleteExport = (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) return res.status(400).json({ error: 'Nom de fichier manquant' });
    const safe = path.basename(filename);
    const filePath = path.join(EXPORTS_DIR, safe);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé' });
    fs.unlinkSync(filePath);
    res.json({ success: true, message: `Fichier ${safe} supprimé` });
  } catch (error) {
    console.error('❌ Erreur deleteExport:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};
