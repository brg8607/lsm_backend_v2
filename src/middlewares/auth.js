const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwt');

// Middleware de autenticación básica
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Middleware de autenticación para administradores
const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.tipo_usuario === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Acceso denegado: Se requiere administrador' });
        }
    });
};

module.exports = {
    authenticateToken,
    authenticateAdmin
};
