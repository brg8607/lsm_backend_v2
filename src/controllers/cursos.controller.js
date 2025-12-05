const db = require('../config/database');

// Obtener todos los cursos (alias de categorías)
const getAllCursos = (req, res) => {
    // Cursos = Categorías
    db.query('SELECT * FROM categorias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Obtener lecciones de un curso (señas de esa categoría)
const getLeccionesByCurso = (req, res) => {
    // Lecciones = Señas de esa categoría
    const categoria_id = req.params.id;
    db.query('SELECT * FROM senas WHERE categoria_id = ?', [categoria_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

module.exports = {
    getAllCursos,
    getLeccionesByCurso
};
