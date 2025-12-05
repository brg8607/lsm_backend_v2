const db = require('../config/database');

// Obtener todas las categorías
const getAllCategorias = (req, res) => {
    db.query('SELECT * FROM categorias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

module.exports = {
    getAllCategorias
};
