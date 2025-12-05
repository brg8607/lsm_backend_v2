const db = require('../config/database');

// Obtener señas (Búsqueda y Filtrado)
const getAllSenas = (req, res) => {
    const { categoria_id, busqueda } = req.query;
    let query = 'SELECT s.*, c.nombre as categoria_nombre FROM senas s JOIN categorias c ON s.categoria_id = c.id WHERE 1=1';
    const params = [];

    if (categoria_id) {
        query += ' AND s.categoria_id = ?';
        params.push(categoria_id);
    }
    if (busqueda) {
        query += ' AND s.palabra LIKE ?';
        params.push(`%${busqueda}%`);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Detalle de una seña
const getSenaById = (req, res) => {
    db.query('SELECT * FROM senas WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Seña no encontrada' });
        res.json(results[0]);
    });
};

module.exports = {
    getAllSenas,
    getSenaById
};
