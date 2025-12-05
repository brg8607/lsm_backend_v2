const db = require('../config/database');

// Sumar puntos
const sumarPuntos = (req, res) => {
    const { puntos } = req.body;
    const user_id = req.user.id;

    if (!puntos || isNaN(puntos)) {
        return res.status(400).json({ error: 'Cantidad de puntos inválida' });
    }

    const query = 'UPDATE usuarios SET puntos = puntos + ? WHERE id = ?';
    db.query(query, [puntos, user_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Devolver el nuevo total
        db.query('SELECT puntos FROM usuarios WHERE id = ?', [user_id], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: 'Puntos sumados', total_puntos: results[0].puntos });
        });
    });
};

// Obtener puntos actuales
const getPuntosActual = (req, res) => {
    const user_id = req.user.id;

    db.query('SELECT puntos FROM usuarios WHERE id = ?', [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.json({ puntos: results[0].puntos });
    });
};

module.exports = {
    sumarPuntos,
    getPuntosActual
};
