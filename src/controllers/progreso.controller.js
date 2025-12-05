const db = require('../config/database');

// Obtener progreso general
const getProgreso = (req, res) => {
    const usuario_id = req.user.id;
    const query = `
        SELECT c.id as categoria_id, c.nombre, COALESCE(p.porcentaje_completado, 0) as porcentaje
        FROM categorias c
        LEFT JOIN progreso_usuario p ON c.id = p.categoria_id AND p.usuario_id = ?
    `;

    db.query(query, [usuario_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Actualizar progreso (Categorías)
const actualizarProgreso = (req, res) => {
    const { categoria_id, incremento } = req.body;
    const usuario_id = req.user.id;

    // Primero obtener progreso actual
    db.query('SELECT * FROM progreso_usuario WHERE usuario_id = ? AND categoria_id = ?', [usuario_id, categoria_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        let nuevoPorcentaje = incremento;
        if (results.length > 0) {
            nuevoPorcentaje = Math.min(100, results[0].porcentaje_completado + incremento);
            db.query('UPDATE progreso_usuario SET porcentaje_completado = ? WHERE id = ?', [nuevoPorcentaje, results[0].id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ mensaje: 'Progreso actualizado', porcentaje: nuevoPorcentaje });
            });
        } else {
            nuevoPorcentaje = Math.min(100, incremento);
            db.query('INSERT INTO progreso_usuario (usuario_id, categoria_id, porcentaje_completado) VALUES (?, ?, ?)', [usuario_id, categoria_id, nuevoPorcentaje], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ mensaje: 'Progreso iniciado', porcentaje: nuevoPorcentaje });
            });
        }
    });
};

// Guardar progreso de Quiz
const guardarProgreso = (req, res) => {
    const { categoria_id, nivel, indice } = req.body;
    const user_id = req.user.id;
    const completado = indice >= 10;

    // Upsert (Insertar o Actualizar)
    const query = `
        INSERT INTO progreso_quiz (user_id, categoria_id, nivel, indice_pregunta, completado)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        nivel = VALUES(nivel),
        indice_pregunta = VALUES(indice_pregunta),
        completado = VALUES(completado)
    `;

    db.query(query, [user_id, categoria_id, nivel, indice, completado], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Progreso guardado' });
    });
};

// Obtener Mapa de Progreso (Home)
const getMapaProgreso = (req, res) => {
    const user_id = req.user.id;

    // Obtener todas las categorías y su progreso
    const query = `
        SELECT c.id, c.nombre, c.icon_url, 
               p.nivel, p.indice_pregunta, p.completado
        FROM categorias c
        LEFT JOIN progreso_quiz p ON c.id = p.categoria_id AND p.user_id = ?
        ORDER BY c.id ASC
    `;

    db.query(query, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        // Calcular bloqueado/desbloqueado
        // Regla: La primera siempre desbloqueada.
        // Las siguientes desbloqueadas si la anterior está completada.

        const mapa = results.map((cat, index) => {
            let bloqueado = false;
            if (index > 0) {
                const categoriaAnterior = results[index - 1];
                // Si la anterior no tiene registro o no está completada, esta se bloquea
                if (!categoriaAnterior.completado) {
                    bloqueado = true;
                }
            }

            return {
                id: cat.id,
                nombre: cat.nombre,
                icon_url: cat.icon_url,
                bloqueado: bloqueado,
                completado: !!cat.completado,
                nivel: cat.nivel || 1,
                indice: cat.indice_pregunta || 0
            };
        });

        res.json(mapa);
    });
};

// Obtener progreso actual (Continuar)
const getProgresoActual = (req, res) => {
    const user_id = req.user.id;

    // Obtenemos el último modificado
    const query = `
        SELECT p.*, c.nombre as categoria_nombre 
        FROM progreso_quiz p
        JOIN categorias c ON p.categoria_id = c.id
        WHERE p.user_id = ?
        ORDER BY p.updated_at DESC
        LIMIT 1
    `;

    db.query(query, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            // Si no hay progreso, devolver null o un objeto por defecto
            // Frontend espera 404 si no hay datos? O null?
            // "Devuelve { ... } para que el botón sepa a dónde ir."
            // Si no hay, devolvemos 404 para que el botón se oculte o muestre "Empezar"
            return res.status(404).json({ error: 'No hay progreso reciente' });
        }

        const p = results[0];
        // Calcular porcentaje (asumiendo 10 preguntas)
        const porcentaje = Math.min(1, (p.indice_pregunta || 0) / 10);

        res.json({
            categoria_id: p.categoria_id,
            nivel: p.nivel,
            progreso_percent: porcentaje,
            categoria_nombre: p.categoria_nombre
        });
    });
};

module.exports = {
    getProgreso,
    actualizarProgreso,
    guardarProgreso,
    getMapaProgreso,
    getProgresoActual
};
