const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller');

router.get('/', categoriasController.getAllCategorias);

module.exports = router;
