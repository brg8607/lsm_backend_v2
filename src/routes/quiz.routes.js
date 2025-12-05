const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const { authenticateToken } = require('../middlewares/auth');

router.get('/generarDinamico', authenticateToken, quizController.generarQuizDinamico);
router.post('/resultado', authenticateToken, quizController.enviarResultado);
router.post('/diario/completar', authenticateToken, quizController.completarQuizDiario);
router.get('/diario/estado', authenticateToken, quizController.estadoQuizDiario);

module.exports = router;
