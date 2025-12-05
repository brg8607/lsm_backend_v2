const express = require('express');
const router = express.Router();
const puntosController = require('../controllers/puntos.controller');
const { authenticateToken } = require('../middlewares/auth');

router.post('/sumar', authenticateToken, puntosController.sumarPuntos);
router.get('/actual', authenticateToken, puntosController.getPuntosActual);

module.exports = router;
