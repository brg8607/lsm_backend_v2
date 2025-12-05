const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// A. AUTENTICACIÓN
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.post('/guest', authController.guestLogin);

module.exports = router;
