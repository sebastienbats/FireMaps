const express = require('express');
const router = express.Router();
const {
  exportCSV,
  exportGeoJSON,
  listExports,
  deleteExport
} = require('../controllers/exportController');

router.post('/csv', exportCSV);
router.post('/geojson', exportGeoJSON);
router.get('/list', listExports);
router.delete('/:filename', deleteExport);

module.exports = router;
