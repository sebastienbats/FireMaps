const fs = require('fs');
const path = require('path');

const EXPORTS_DIR = path.join(__dirname, '../exports');

// Créer le dossier exports s'il n'existe pas
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Fonction pour générer un nom de fichier unique
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

    // Générer le CSV en streaming pour éviter les problèmes de mémoire
    const headers = ['latitude', 'longitude', 'confidence', 'frp', 'acq_date', 'acq_time', 'type'];
    
    // Construire le CSV
    let csv = headers.join(',') + '\n';
    
    // Ajouter les données ligne par ligne (plus efficace pour les gros volumes)
    for (const f of data) {
      const row = headers.map(h => {
        const value = f[h] || '';
        // Échapper les guillemets et les virgules si nécessaire
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += row.join(',') + '\n';
    }

    // Générer un nom de fichier
    const baseFilename = filename || generateFilename('fires');
    const fullFilename = `${baseFilename}.csv`;
    const filePath = path.join(EXPORTS_DIR, fullFilename);

    // Écrire le fichier
    fs.writeFileSync(filePath, csv, 'utf8');
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`✅ CSV exporté: ${fullFilename} (${(fileSize / 1024).toFixed(1)} KB)`);

    res.json({
      success: true,
      filename: fullFilename,
      downloadUrl: `/exports/${fullFilename}`,
      size: fileSize,
      count: data.length
    });

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

    // Générer le GeoJSON
    const features = data.map(f => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [f.longitude, f.latitude]
      },
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
      metadata: {
        exportedAt: new Date().toISOString(),
        count: features.length,
        source: 'NASA FIRMS'
      }
    };

    // Générer un nom de fichier
    const baseFilename = filename || generateFilename('fires');
    const fullFilename = `${baseFilename}.geojson`;
    const filePath = path.join(EXPORTS_DIR, fullFilename);

    // Écrire le fichier (avec formatage pour la lisibilité)
    const jsonString = JSON.stringify(geojson, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`✅ GeoJSON exporté: ${fullFilename} (${(fileSize / 1024).toFixed(1)} KB)`);

    res.json({
      success: true,
      filename: fullFilename,
      downloadUrl: `/exports/${fullFilename}`,
      size: fileSize,
      count: data.length
    });

  } catch (error) {
    console.error('❌ Erreur export GeoJSON:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export GeoJSON: ' + error.message });
  }
};

exports.listExports = (req, res) => {
  try {
    const files = fs.readdirSync(EXPORTS_DIR);
    const exports = files
      .filter(file => file.endsWith('.csv') || file.endsWith('.geojson'))
      .map(file => {
        const stats = fs.statSync(path.join(EXPORTS_DIR, file));
        return {
          filename: file,
          url: `/exports/${file}`,
          size: stats.size,
          sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);

    res.json({ 
      exports,
      count: exports.length,
      directory: EXPORTS_DIR
    });
  } catch (error) {
    console.error('❌ Erreur listExports:', error);
    res.status(500).json({ error: 'Erreur lors de la liste des exports' });
  }
};

// Fonction pour supprimer un export (optionnel)
exports.deleteExport = (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'Nom de fichier manquant' });
    }

    // Sécurité : empêcher la navigation hors du dossier exports
    const safeFilename = path.basename(filename);
    const filePath = path.join(EXPORTS_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: `Fichier ${safeFilename} supprimé` });

  } catch (error) {
    console.error('❌ Erreur deleteExport:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};
