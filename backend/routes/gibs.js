const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Proxy pour les tuiles GIBS
router.get('/tile/:z/:x/:y/:layer.png', async (req, res) => {
  try {
    const { z, x, y, layer } = req.params;
    
    // URL GIBS
    const url = `https://gibs.earthdata.nasa.gov/tile/epsg4326/best/${z}/${x}/${y}/${layer}.png`;
    
    console.log(`🌿 Proxy GIBS: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ Erreur GIBS: ${response.status}`);
      return res.status(response.status).send('Erreur GIBS');
    }
    
    // Définir les headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'image/png');
    
    // Streamer l'image
    response.body.pipe(res);
    
  } catch (error) {
    console.error('❌ Erreur proxy GIBS:', error);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
