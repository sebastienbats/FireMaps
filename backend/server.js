require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour parser les requêtes JSON (limite augmentée pour les exports)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Dossier des exports (fichiers statiques)
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// ============================================================
// ROUTES API
// ============================================================

// Route FIRMS (feux)
app.use('/api/fires', require('./routes/fires'));

// Route Exports (CSV/GeoJSON)
app.use('/api/exports', require('./routes/exports'));

// Route GIBS Proxy (tuiles NASA)
app.use('/api/gibs', require('./routes/gibs'));

// ============================================================
// ROUTE DE SANTÉ
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      firms: '/api/fires',
      exports: '/api/exports',
      gibs: '/api/gibs/tile/{z}/{x}/{y}/{layer}.png'
    }
  });
});

// ============================================================
// GESTION DES ERREURS
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  
  // Erreur de payload trop large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Les données sont trop volumineuses pour l\'export',
      details: 'Essayez de réduire le nombre de feux avec les filtres'
    });
  }
  
  // Erreur générique
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: err.message 
  });
});

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Backend démarré sur http://localhost:${PORT}`);
  console.log(`📡 API FIRMS: /api/fires`);
  console.log(`📤 Exports: /api/exports`);
  console.log(`🌿 Proxy GIBS: /api/gibs/tile/{z}/{x}/{y}/{layer}.png`);
  console.log(`📦 Limite des requêtes: 50MB\n`);
});

// Gestion des signaux d'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur...');
  process.exit(0);
});

module.exports = app;
