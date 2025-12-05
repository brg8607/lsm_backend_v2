const db = require('../config/database');

// Generar Quiz Dinámico (MEJORADO: COHERENCIA DE CATEGORÍA)
const generarQuizDinamico = (req, res) => {
    const { categoria_id, nivel } = req.query;
    let limit = 15; // Default para Quiz del Día
    let query = 'SELECT * FROM senas';
    let params = [];
    let titulo = "Quiz del Día";

    // 1. Configurar la consulta principal (Preguntas Correctas)
    if (categoria_id) {
        limit = 10; // Quiz por categoría es más corto
        query += ' WHERE categoria_id = ?';
        params.push(categoria_id);
        titulo = "Quiz de Categoría";
    }

    // Orden aleatorio y límite
    query += ' ORDER BY RAND() LIMIT ?';
    params.push(limit);

    // Ejecutar consulta principal
    db.query(query, params, (err, senas) => {
        if (err) return res.status(500).json({ error: err.message });

        if (senas.length === 0) return res.json({ id: Date.now(), titulo, preguntas: [] });

        // 2. Configurar consulta de Distractores (Opciones Incorrectas)
        // EXCLUSIÓN: No queremos que la respuesta correcta salga como distractor duplicado, 
        // pero eso lo filtramos en memoria más abajo para simplificar la query.

        let distractorQuery = 'SELECT palabra FROM senas WHERE id NOT IN (?)';
        let distractorParams = [senas.map(s => s.id)]; // Excluir las que ya son preguntas

        if (categoria_id) {
            // LÓGICA DE COHERENCIA: Si es categoría específica, SOLO traer distractores de esa categoría
            distractorQuery += ' AND categoria_id = ?';
            distractorParams.push(categoria_id);
        }

        distractorQuery += ' ORDER BY RAND() LIMIT 100'; // Traemos suficientes para elegir

        db.query(distractorQuery, distractorParams, (err, poolDistractores) => {
            if (err) return res.status(500).json({ error: err.message });

            // 3. Armar las preguntas
            const preguntas = senas.map(sena => {
                const misDistractores = [];

                // Copiamos el pool para no modificar el original y poder reusar palabras si es necesario
                // (aunque idealmente no se repiten en la misma pregunta)
                const poolCopia = [...poolDistractores];

                // Intentar llenar con distractores de la MISMA categoría
                while (misDistractores.length < 3 && poolCopia.length > 0) {
                    const randomIndex = Math.floor(Math.random() * poolCopia.length);
                    const distractor = poolCopia.splice(randomIndex, 1)[0];

                    // Asegurar que no sea igual a la respuesta correcta ni esté ya agregado
                    if (distractor.palabra !== sena.palabra && !misDistractores.includes(distractor.palabra)) {
                        misDistractores.push(distractor.palabra);
                    }
                }

                // FALLBACK DE EMERGENCIA: Si la categoría es muy pequeña (ej. tiene 2 palabras)
                // y no alcanzamos a llenar 3 opciones, rellenamos con genéricos para que no crashee.
                while (misDistractores.length < 3) {
                    misDistractores.push('Opción Extra ' + (misDistractores.length + 1));
                }

                // Mezclar respuesta correcta con distractores
                const opciones = [sena.palabra, ...misDistractores].sort(() => Math.random() - 0.5);

                return {
                    id: sena.id,
                    pregunta_texto: `¿Qué significa esta seña?`,
                    video_asociado_url: sena.video_url,
                    imagen_asociada_url: sena.imagen_url,
                    respuesta_correcta: sena.palabra,
                    opciones: opciones
                };
            });

            res.json({
                id: Date.now(),
                titulo: titulo,
                preguntas: preguntas
            });
        });
    });
};

// Enviar resultados del Quiz
const enviarResultado = (req, res) => {
    const { quiz_id, puntaje } = req.body;
    const usuario_id = req.user.id;

    const query = 'INSERT INTO quiz_resultados (usuario_id, quiz_id, puntaje) VALUES (?, ?, ?)';
    db.query(query, [usuario_id, quiz_id, puntaje], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Aquí podrías calcular puntos totales del usuario y devolverlos
        res.status(201).json({ mensaje: 'Puntaje guardado', nuevos_puntos: puntaje }); // Simplificado
    });
};

// Completar quiz diario
const completarQuizDiario = (req, res) => {
    const { puntuacion } = req.body;
    const user_id = req.user.id;

    if (puntuacion === undefined || isNaN(puntuacion)) {
        return res.status(400).json({ error: 'Puntuación inválida' });
    }

    // Obtener fecha de hoy en formato YYYY-MM-DD
    const hoy = new Date().toISOString().split('T')[0];

    // UPSERT: Insertar o actualizar si ya existe para hoy
    const query = `
        INSERT INTO quiz_diario_completado (user_id, fecha, puntuacion, completado)
        VALUES (?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        puntuacion = VALUES(puntuacion),
        completado = TRUE
    `;

    db.query(query, [user_id, hoy, puntuacion], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            mensaje: 'Quiz diario completado',
            puntuacion: puntuacion,
            fecha: hoy
        });
    });
};

// Verificar estado del quiz diario
const estadoQuizDiario = (req, res) => {
    const user_id = req.user.id;

    // Obtener fecha de hoy en formato YYYY-MM-DD
    const hoy = new Date().toISOString().split('T')[0];

    const query = `
        SELECT puntuacion, fecha, completado 
        FROM quiz_diario_completado 
        WHERE user_id = ? AND fecha = ?
    `;

    db.query(query, [user_id, hoy], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            // No ha completado el quiz de hoy
            return res.json({
                completado: false,
                fecha: hoy
            });
        }

        // Ya completó el quiz de hoy
        res.json({
            completado: true,
            puntuacion: results[0].puntuacion,
            fecha: results[0].fecha
        });
    });
};

module.exports = {
    generarQuizDinamico,
    enviarResultado,
    completarQuizDiario,
    estadoQuizDiario
};
