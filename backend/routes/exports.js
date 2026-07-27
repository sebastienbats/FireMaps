const express = require('express');
const router = express.Router();
const { exportCSV, exportGeoJSON, listExports } = require('../controllers/exportController');

router.post('/csv', exportCSV);
router.post('/geojson', exportGeoJSON);
router.get('/list', listExports);

module.exports = router;
