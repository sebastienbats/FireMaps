const express = require('express');
const router = express.Router();
const { getFires, getSources } = require('../controllers/fireController');

router.get('/', getFires);
router.get('/sources', getSources);

module.exports = router;
