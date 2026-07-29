const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Cache simple pour les tuiles (optionnel)
const tileCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Proxy pour les tuiles GIBS
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
    
    // URL GIBS
    const url = `https://gibs.earthdata.nasa.gov/tile/epsg4326/best/${z}/${x}/${y}/${layer}.png`;
    
    console.log(`🌿 Proxy GIBS: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FireMaps/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Erreur GIBS (${response.status}): ${url}`);
      return res.status(response.status).send(`Erreur GIBS: ${response.status}`);
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

// Route OPTIONS pour CORS
router.options('/tile/:z/:x/:y/:layer.png', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).send();
});

module.exports = router;
