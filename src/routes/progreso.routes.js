const express = require('express');
const router = express.Router();
const progresoController = require('../controllers/progreso.controller');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, progresoController.getProgreso);
router.post('/actualizar', authenticateToken, progresoController.actualizarProgreso);
router.post('/guardar', authenticateToken, progresoController.guardarProgreso);
router.get('/mapa', authenticateToken, progresoController.getMapaProgreso);
router.get('/actual', authenticateToken, progresoController.getProgresoActual);

module.exports = router;
