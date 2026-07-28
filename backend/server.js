require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/exports', express.static(path.join(__dirname, 'exports')));

app.use('/api/fires', require('./routes/fires'));
app.use('/api/exports', require('./routes/exports'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Les données sont trop volumineuses pour l\'export',
      details: 'Essayez de réduire le nombre de feux avec les filtres'
    });
  }
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend démarré sur http://localhost:${PORT}`);
  console.log(`📡 API FIRMS configurée (format CSV)`);
  console.log(`📦 Limite des requêtes: 50MB`);
});
