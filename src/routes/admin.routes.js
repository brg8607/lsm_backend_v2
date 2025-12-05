const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middlewares/auth');
const upload = require('../config/multer');

// Señas
router.post('/senas', authenticateAdmin, upload.single('video'), adminController.crearSena);
router.put('/senas/:id', authenticateAdmin, adminController.editarSena);
router.delete('/senas/:id', authenticateAdmin, adminController.eliminarSena);

// Estadísticas
router.get('/stats', authenticateAdmin, adminController.getStats);
router.get('/stats/users', authenticateAdmin, adminController.getUsuarios);
router.get('/stats/progress/:userId', authenticateAdmin, adminController.getProgresoUsuario);

// Categorías
router.post('/categorias', authenticateAdmin, adminController.crearCategoria);
router.put('/categorias/:id', authenticateAdmin, adminController.editarCategoria);
router.delete('/categorias/:id', authenticateAdmin, adminController.eliminarCategoria);

// Quizzes
router.post('/quiz', authenticateAdmin, adminController.crearQuiz);
router.get('/quiz', authenticateAdmin, adminController.listarQuizzes);
router.delete('/quiz/:id', authenticateAdmin, adminController.eliminarQuiz);

module.exports = router;
