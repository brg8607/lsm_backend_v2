const express = require('express');
const router = express.Router();
const cursosController = require('../controllers/cursos.controller');

router.get('/', cursosController.getAllCursos);
router.get('/:id/lecciones', cursosController.getLeccionesByCurso);

module.exports = router;
