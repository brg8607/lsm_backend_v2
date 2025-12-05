const express = require('express');
const router = express.Router();
const senasController = require('../controllers/senas.controller');

router.get('/', senasController.getAllSenas);
router.get('/:id', senasController.getSenaById);

module.exports = router;
