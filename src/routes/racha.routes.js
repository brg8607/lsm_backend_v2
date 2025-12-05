const express = require('express');
const router = express.Router();
const rachaController = require('../controllers/racha.controller');
const { authenticateToken } = require('../middlewares/auth');

router.post('/sesion/registrar', authenticateToken, rachaController.registrarSesion);
router.get('/racha/actual', authenticateToken, rachaController.getRachaActual);

module.exports = router;
