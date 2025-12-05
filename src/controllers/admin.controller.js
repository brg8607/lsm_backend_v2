const db = require('../config/database');

// Subir nueva seña (Video opcional)
const crearSena = (req, res) => {
    const { palabra, categoria_id, descripcion } = req.body;
    const video_url = req.file ? req.file.path : null;

    if (!palabra || !categoria_id) {
        return res.status(400).json({ error: 'Palabra y categoría son requeridos' });
    }

    const query = 'INSERT INTO senas (categoria_id, palabra, descripcion, video_url) VALUES (?, ?, ?, ?)';
    db.query(query, [categoria_id, palabra, descripcion, video_url], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
            mensaje: 'Seña creada', 
            id: result.insertId,
            sena: { id: result.insertId, palabra, descripcion, categoria_id, video_url }
        });
    });
};

// Editar seña
const editarSena = (req, res) => {
    const { palabra, descripcion, categoria_id } = req.body;
    const { id } = req.params;

    const query = 'UPDATE senas SET palabra = ?, descripcion = ?, categoria_id = ? WHERE id = ?';
    db.query(query, [palabra, descripcion, categoria_id, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Seña no encontrada' });
        res.json({ mensaje: 'Seña actualizada' });
    });
};

// Borrar seña
const eliminarSena = (req, res) => {
    db.query('DELETE FROM senas WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Seña no encontrada' });
        res.json({ mensaje: 'Seña eliminada' });
    });
};

// Estadísticas generales del sistema
const getStats = (req, res) => {
    const stats = {};

    // 1. Total de usuarios
    db.query('SELECT COUNT(*) as count FROM usuarios', (err, resUser) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.total_usuarios = resUser[0].count;

        // 2. Usuarios activos (con progreso en los últimos 30 días)
        const treintaDiasAtras = new Date();
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
        const fechaLimite = treintaDiasAtras.toISOString().split('T')[0];

        db.query(
            'SELECT COUNT(DISTINCT user_id) as count FROM progreso_quiz WHERE updated_at >= ?',
            [fechaLimite],
            (err, resActivos) => {
                if (err) {
                    // Si falla, intentar con otra tabla o poner 0
                    stats.usuarios_activos = 0;
                } else {
                    stats.usuarios_activos = resActivos[0].count;
                }

                // 3. Usuarios que completaron todas las categorías
                db.query(`
                    SELECT COUNT(*) as count FROM (
                        SELECT p.user_id, COUNT(DISTINCT p.categoria_id) as categorias_completadas
                        FROM progreso_quiz p
                        WHERE p.completado = 1
                        GROUP BY p.user_id
                        HAVING categorias_completadas = (SELECT COUNT(*) FROM categorias)
                    ) AS usuarios_completados
                `, (err, resCompletados) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.usuarios_completados = resCompletados[0].count;

                    // 4. Total de categorías
                    db.query('SELECT COUNT(*) as count FROM categorias', (err, resCategorias) => {
                        if (err) return res.status(500).json({ error: err.message });
                        stats.total_categorias = resCategorias[0].count;

                        // 5. Total de señas
                        db.query('SELECT COUNT(*) as count FROM senas', (err, resSenas) => {
                            if (err) return res.status(500).json({ error: err.message });
                            stats.total_senas = resSenas[0].count;

                            // 6. Usuario con mayor racha - Sin usar racha_dias
                            // Por ahora retornamos null ya que calcular desde sesiones_diarias 
                            // puede ser costoso. Puedes implementarlo después si quieres.
                            stats.usuario_top_racha = null;

                            res.json(stats);
                        });
                    });
                });
            }
        );
    });
};

// Listar todos los usuarios con progreso
const getUsuarios = (req, res) => {
    const query = `
        SELECT 
            u.id,
            u.nombre,
            u.correo,
            u.tipo_usuario,
            u.fecha_registro,
            (SELECT COUNT(DISTINCT categoria_id) 
             FROM progreso_quiz 
             WHERE user_id = u.id AND completado = 1) as quizzes_completados,
            (SELECT COUNT(DISTINCT categoria_id) 
             FROM progreso_quiz 
             WHERE user_id = u.id AND completado = 1) as categorias_completadas,
            (SELECT COUNT(*) 
             FROM categorias) as total_categorias,
            (SELECT MAX(updated_at) 
             FROM progreso_quiz 
             WHERE user_id = u.id) as ultima_actividad
        FROM usuarios u
        WHERE u.tipo_usuario = 'normal'
        ORDER BY u.fecha_registro DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error en stats/users:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const formattedResults = results.map(user => ({
            ...user,
            progreso_promedio: user.total_categorias > 0 
                ? ((user.categorias_completadas / user.total_categorias) * 100).toFixed(1)
                : 0
        }));
        
        res.json(formattedResults);
    });
};

// Progreso detallado de un usuario específico
const getProgresoUsuario = (req, res) => {
    const userId = req.params.userId;

    // Obtener información del usuario
    db.query('SELECT id, nombre, correo, tipo_usuario, fecha_registro FROM usuarios WHERE id = ?', [userId], (err, userResults) => {
        if (err) {
            console.error('Error obteniendo usuario:', err);
            return res.status(500).json({ error: err.message });
        }
        if (userResults.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const usuario = userResults[0];

        // Obtener progreso por categoría - UNA FILA POR CATEGORÍA
        const queryProgreso = `
            SELECT 
                c.id as categoria_id,
                c.nombre as categoria_nombre,
                c.icon_url,
                MAX(COALESCE(pq.nivel, 1)) as nivel,
                MAX(COALESCE(pq.indice_pregunta, 0)) as indice_pregunta,
                MAX(COALESCE(pq.completado, 0)) as completado,
                MAX(COALESCE((pq.indice_pregunta / 10.0) * 100, 0)) as porcentaje_completado,
                MAX(pq.updated_at) as ultimo_acceso
            FROM categorias c
            LEFT JOIN progreso_quiz pq ON c.id = pq.categoria_id AND pq.user_id = ?
            GROUP BY c.id, c.nombre, c.icon_url
            ORDER BY c.id ASC
        `;

        db.query(queryProgreso, [userId], (err, progresoResults) => {
            if (err) {
                console.error('Error en queryProgreso:', err);
                return res.status(500).json({ error: err.message });
            }

            // Calcular estadísticas de quizzes desde progreso_quiz
            const categoriasCompletadas = progresoResults.filter(p => p.completado === 1).length;
            const totalCategorias = progresoResults.length;
            
            // Contar cuántas categorías tiene progreso (ha jugado al menos 1 vez)
            const categoriasJugadas = progresoResults.filter(p => p.indice_pregunta > 0).length;
            
            // Calcular promedio de preguntas completadas
            const totalPreguntasRespondidas = progresoResults.reduce((sum, p) => sum + (p.indice_pregunta || 0), 0);
            const promedioPuntaje = categoriasJugadas > 0 
                ? ((totalPreguntasRespondidas / (categoriasJugadas * 10)) * 100).toFixed(1)
                : 0;
            
            const progresoGeneral = totalCategorias > 0 
                ? ((categoriasCompletadas / totalCategorias) * 100).toFixed(1) 
                : 0;

            console.log(`Usuario ${userId}:`);
            console.log(`  - Categorías completadas: ${categoriasCompletadas}/${totalCategorias}`);
            console.log(`  - Categorías con progreso: ${categoriasJugadas}`);
            console.log(`  - Total preguntas respondidas: ${totalPreguntasRespondidas}`);
            console.log(`  - Promedio de completitud: ${promedioPuntaje}%`);

            res.json({
                usuario: usuario,
                progreso_categorias: progresoResults,
                historial_quizzes: [], // Vacío por ahora ya que no usas esa tabla
                resumen: {
                    total_categorias: totalCategorias,
                    categorias_completadas: categoriasCompletadas,
                    quizzes_realizados: categoriasJugadas, // Cuántas categorías ha jugado
                    promedio_puntaje: promedioPuntaje // Promedio de preguntas correctas
                }
            });
        });
    });
};

// Crear nueva categoría
const crearCategoria = (req, res) => {
    const { nombre, icon_url, descripcion } = req.body;

    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const query = 'INSERT INTO categorias (nombre, icon_url, descripcion) VALUES (?, ?, ?)';
    db.query(query, [nombre, icon_url || null, descripcion || null], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
            mensaje: 'Categoría creada exitosamente',
            id: result.insertId,
            categoria: { id: result.insertId, nombre, icon_url, descripcion }
        });
    });
};

// Editar categoría
const editarCategoria = (req, res) => {
    const { nombre, icon_url, descripcion } = req.body;
    const { id } = req.params;

    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const query = 'UPDATE categorias SET nombre = ?, icon_url = ?, descripcion = ? WHERE id = ?';
    db.query(query, [nombre, icon_url || null, descripcion || null, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ mensaje: 'Categoría actualizada exitosamente' });
    });
};

// Eliminar categoría
const eliminarCategoria = (req, res) => {
    const { id } = req.params;

    // Verificar si hay señas asociadas a esta categoría
    db.query('SELECT COUNT(*) as count FROM senas WHERE categoria_id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const senasCount = results[0].count;
        if (senasCount > 0) {
            return res.status(400).json({
                error: `No se puede eliminar la categoría porque tiene ${senasCount} señas asociadas. Elimina las señas primero.`
            });
        }

        // Si no hay señas, proceder a eliminar
        db.query('DELETE FROM categorias WHERE id = ?', [id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
            res.json({ mensaje: 'Categoría eliminada exitosamente' });
        });
    });
};

// Crear Quiz (Admin) - Transaccional
const crearQuiz = (req, res) => {
    const { titulo, fecha_disponible, preguntas } = req.body; // preguntas es array

    if (!titulo || !fecha_disponible || !preguntas || preguntas.length === 0) {
        return res.status(400).json({ error: 'Faltan datos del quiz' });
    }

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: err.message });

        // 1. Insertar Quiz
        db.query('INSERT INTO quizzes (titulo, fecha_programada) VALUES (?, ?)', [titulo, fecha_disponible], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ error: err.message });
                });
            }

            const quizId = result.insertId;

            // 2. Insertar Preguntas
            // Preparamos los valores para inserción múltiple
            const values = preguntas.map(p => [
                quizId,
                p.pregunta_texto,
                p.video_asociado_url,
                p.opcion_correcta,
                p.opcion_incorrecta1,
                p.opcion_incorrecta2,
                p.opcion_incorrecta3
            ]);

            const queryPreguntas = 'INSERT INTO quiz_preguntas (quiz_id, pregunta_texto, video_asociado_url, opcion_correcta, opcion_incorrecta1, opcion_incorrecta2, opcion_incorrecta3) VALUES ?';

            db.query(queryPreguntas, [values], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ error: err.message });
                    });
                }

                db.commit(err => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: err.message });
                        });
                    }
                    res.status(201).json({ mensaje: 'Quiz creado exitosamente', id: quizId });
                });
            });
        });
    });
};

// Listar todos los quizzes
const listarQuizzes = (req, res) => {
    const query = `
        SELECT 
            q.id,
            q.titulo,
            q.fecha_programada,
            q.creado_en,
            COUNT(qp.id) as total_preguntas
        FROM quizzes q
        LEFT JOIN quiz_preguntas qp ON q.id = qp.quiz_id
        GROUP BY q.id, q.titulo, q.fecha_programada, q.creado_en
        ORDER BY q.fecha_programada DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Eliminar quiz
const eliminarQuiz = (req, res) => {
    const { id } = req.params;

    // Las preguntas se eliminan automáticamente por CASCADE
    db.query('DELETE FROM quizzes WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Quiz no encontrado' });
        res.json({ mensaje: 'Quiz eliminado exitosamente' });
    });
};

module.exports = {
    crearSena,
    editarSena,
    eliminarSena,
    getStats,
    getUsuarios,
    getProgresoUsuario,
    crearCategoria,
    editarCategoria,
    eliminarCategoria,
    crearQuiz,
    listarQuizzes,
    eliminarQuiz
};
