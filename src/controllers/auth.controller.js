const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const JWT_SECRET = require('../config/jwt');

// 1. Registro Normal
const register = async (req, res) => {
    const { nombre, correo, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO usuarios (nombre, correo, password_hash, tipo_usuario) VALUES (?, ?, ?, ?)';

        db.query(query, [nombre, correo, hashedPassword, 'normal'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'El correo ya está registrado' });
                }
                return res.status(500).json({ error: err.message });
            }

            const user = { id: result.insertId, nombre, tipo: 'normal' };
            const token = jwt.sign(user, JWT_SECRET);
            res.status(201).json({ mensaje: 'Usuario creado', token, usuario: user });
        });
    } catch (e) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

// 2. Login Normal
const login = (req, res) => {
    const { correo, password } = req.body;

    db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ error: 'Usuario no encontrado' });

        const user = results[0];
        if (!user.password_hash) return res.status(400).json({ error: 'Usa login con Google' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

        const tokenPayload = { id: user.id, nombre: user.nombre, tipo_usuario: user.tipo_usuario };
        const token = jwt.sign(tokenPayload, JWT_SECRET);

        res.json({ mensaje: 'Login exitoso', token, usuario: tokenPayload });
    });
};

// 3. Login/Registro con Google
const googleAuth = (req, res) => {
    const { token_google, nombre, correo, google_uid } = req.body;
    // Aquí idealmente verificarías el token_google con la API de Google

    db.query('SELECT * FROM usuarios WHERE google_uid = ?', [google_uid], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            // Login existente
            const user = results[0];
            const tokenPayload = { id: user.id, nombre: user.nombre, tipo_usuario: user.tipo_usuario };
            const token = jwt.sign(tokenPayload, JWT_SECRET);
            return res.json({ mensaje: 'Login Google exitoso', token, usuario: tokenPayload });
        } else {
            // Registro nuevo
            const query = 'INSERT INTO usuarios (nombre, correo, google_uid, tipo_usuario) VALUES (?, ?, ?, ?)';
            db.query(query, [nombre, correo, google_uid, 'normal'], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });

                const user = { id: result.insertId, nombre, tipo_usuario: 'normal' };
                const token = jwt.sign(user, JWT_SECRET);
                res.status(201).json({ mensaje: 'Usuario Google creado', token, usuario: user });
            });
        }
    });
};

// 4. Ingreso como Invitado
const guestLogin = (req, res) => {
    // Crea un usuario temporal o simplemente devuelve un token con rol invitado
    // Para persistencia, creamos un usuario invitado en la BD
    const nombre = 'Invitado ' + Math.floor(Math.random() * 1000);
    const query = 'INSERT INTO usuarios (nombre, tipo_usuario) VALUES (?, ?)';

    db.query(query, [nombre, 'invitado'], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const user = { id: result.insertId, nombre, tipo_usuario: 'invitado' };
        const token = jwt.sign(user, JWT_SECRET);
        res.json({ mensaje: 'Ingreso como invitado', token, usuario: user });
    });
};

module.exports = {
    register,
    login,
    googleAuth,
    guestLogin
};
