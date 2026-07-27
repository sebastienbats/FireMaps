require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS plus permissif pour le développement
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// IMPORTANT: Augmenter la limite de taille pour les requêtes JSON
// La limite est augmentée à 50MB pour permettre l'export de grandes quantités de données
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir les fichiers statiques (exports)
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Routes
app.use('/api/fires', require('./routes/fires'));
app.use('/api/exports', require('./routes/exports'));

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  
  // Gestion spécifique des erreurs de payload trop large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: 'Les données sont trop volumineuses pour l\'export',
      details: 'Essayez de réduire le nombre de feux en utilisant les filtres'
    });
  }
  
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend démarré sur http://localhost:${PORT}`);
  console.log(`📡 API FIRMS configurée avec format CSV`);
  console.log(`📦 Limite de taille des requêtes: 50MB`);
});
