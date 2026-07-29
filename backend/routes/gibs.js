const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Cache pour les tuiles
const tileCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// Liste des sources alternatives pour GIBS
const GIBS_LAYERS = {
  'MOD13A2_NDVI': {
    name: 'MOD13A2_NDVI',
    styles: 'palette/ndvi',
    type: 'wms'
  },
  'MOD11A1_LST_Day_1km': {
    name: 'MOD11A1_LST_Day_1km',
    styles: 'palette/thermal',
    type: 'wms'
  },
  'MOD11A1_LST_Night_1km': {
    name: 'MOD11A1_LST_Night_1km',
    styles: 'palette/thermal',
    type: 'wms'
  }
};

// Proxy pour les tuiles GIBS avec fallback
router.get('/tile/:z/:x/:y/:layer.png', async (req, res) => {
  try {
    const { z, x, y, layer } = req.params;
    
    // Vérifier le cache
    const cacheKey = `${z}/${x}/${y}/${layer}`;
    if (tileCache.has(cacheKey)) {
      const cached = tileCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(cached.data);
      }
      tileCache.delete(cacheKey);
    }
    
    // Essayer différentes URLs
    const urls = [
      // Format 1: EPSG:4326
      `https://gibs.earthdata.nasa.gov/tile/epsg4326/best/${z}/${x}/${y}/${layer}.png`,
      // Format 2: EPSG:3857
      `https://gibs.earthdata.nasa.gov/tile/epsg3857/best/${z}/${x}/${y}/${layer}.png`,
    ];
    
    let response = null;
    let usedUrl = null;
    
    for (const url of urls) {
      console.log(`🌿 Tentative: ${url}`);
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'FireMaps/1.0' },
          timeout: 5000
        });
        if (resp.ok) {
          response = resp;
          usedUrl = url;
          break;
        }
      } catch (e) {
        console.warn(`⚠️ Échec pour ${url}:`, e.message);
      }
    }
    
    if (!response || !response.ok) {
      console.error(`❌ Toutes les tentatives ont échoué pour ${layer}`);
      
      // Fallback: générer une image placeholder
      const placeholder = generatePlaceholder(layer);
      tileCache.set(cacheKey, {
        data: placeholder,
        timestamp: Date.now()
      });
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(placeholder);
    }
    
    // Lire l'image
    const buffer = await response.buffer();
    
    // Mettre en cache
    tileCache.set(cacheKey, {
      data: buffer,
      timestamp: Date.now()
    });
    
    // Définir les headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ Erreur proxy GIBS:', error);
    res.status(500).send('Erreur serveur proxy');
  }
});

// Générer une image placeholder (1x1 pixel transparent)
function generatePlaceholder(layer) {
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  
  // Fond transparent
  ctx.clearRect(0, 0, 256, 256);
  
  // Ajouter un message
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Données GIBS', 128, 120);
  ctx.fillText('indisponibles', 128, 140);
  ctx.fillText(layer.substring(0, 15), 128, 160);
  
  return canvas.toBuffer();
}

router.options('/tile/:z/:x/:y/:layer.png', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).send();
});

module.exports = router;
