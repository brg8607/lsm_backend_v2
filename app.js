const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// --- CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); // Servir archivos estáticos desde public/uploads

// --- LOGGING MIDDLEWARE ---
app.use((req, res, next) => {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${req.url}`);
    next();
});

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Conexión a Base de Datos
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'app_lsm_db',
    port: process.env.DB_PORT || 3306
});

db.connect(err => {
    if (err) {
        console.error('Error conectando a la BD:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_lsm';

// --- MIDDLEWARE DE AUTENTICACIÓN ---
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

const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.tipo_usuario === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Acceso denegado: Se requiere administrador' });
        }
    });
};

// --- ENDPOINTS ---

// A. AUTENTICACIÓN

// 1. Registrar Usuario
app.post('/api/auth/register', async (req, res) => {
    const { nombre, correo, password } = req.body;
    if (!nombre || !correo || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO usuarios (nombre, correo, password_hash) VALUES (?, ?, ?)';

        db.query(query, [nombre, correo, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El correo ya existe' });
                return res.status(500).json({ error: err.message });
            }

            const user = { id: result.insertId, nombre, tipo: 'normal' };
            const token = jwt.sign(user, JWT_SECRET);
            res.status(201).json({ mensaje: 'Usuario creado', token, usuario: user });
        });
    } catch (e) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// 2. Login Normal
app.post('/api/auth/login', (req, res) => {
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
});

// 3. Login/Registro con Google
app.post('/api/auth/google', (req, res) => {
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
});

// 4. Ingreso como Invitado
app.post('/api/auth/guest', (req, res) => {
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
});

// B. CONTENIDO

// 5. Obtener todas las categorías
app.get('/api/categorias', (req, res) => {
    db.query('SELECT * FROM categorias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 6. Obtener señas (Búsqueda y Filtrado)
app.get('/api/senas', (req, res) => {
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
});

// 7. Detalle de una seña
app.get('/api/senas/:id', (req, res) => {
    db.query('SELECT * FROM senas WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Seña no encontrada' });
        res.json(results[0]);
    });
});

// 7b. Módulo de Cursos (Alias)
app.get('/api/cursos', (req, res) => {
    // Cursos = Categorías
    db.query('SELECT * FROM categorias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/cursos/:id/lecciones', (req, res) => {
    // Lecciones = Señas de esa categoría
    const categoria_id = req.params.id;
    db.query('SELECT * FROM senas WHERE categoria_id = ?', [categoria_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// C. ACTIVIDADES (Quiz Diario)

// 8. Generar Quiz Dinámico (MEJORADO: COHERENCIA DE CATEGORÍA)
app.get('/api/quiz/generarDinamico', authenticateToken, (req, res) => {
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
});

// 9. Enviar resultados del Quiz
app.post('/api/quiz/resultado', authenticateToken, (req, res) => {
    const { quiz_id, puntaje } = req.body;
    const usuario_id = req.user.id;

    const query = 'INSERT INTO quiz_resultados (usuario_id, quiz_id, puntaje) VALUES (?, ?, ?)';
    db.query(query, [usuario_id, quiz_id, puntaje], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Aquí podrías calcular puntos totales del usuario y devolverlos
        res.status(201).json({ mensaje: 'Puntaje guardado', nuevos_puntos: puntaje }); // Simplificado
    });
});

// 9b. Crear Quiz (Admin) - Transaccional
app.post('/api/admin/quiz', authenticateAdmin, (req, res) => {
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
});

// D. PROGRESO DE USUARIO

// 10. Obtener progreso general
app.get('/api/progreso', authenticateToken, (req, res) => {
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
});

// 11. Actualizar progreso (Categorías)
app.post('/api/progreso/actualizar', authenticateToken, (req, res) => {
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
});

// 11b. Guardar progreso de Quiz
app.post('/api/progreso/guardar', authenticateToken, (req, res) => {
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
});

// 11c. Obtener Mapa de Progreso (Home)
app.get('/api/progreso/mapa', authenticateToken, (req, res) => {
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
});

// F. SISTEMA DE PUNTUACIÓN

// 15. Sumar puntos
app.post('/api/puntos/sumar', authenticateToken, (req, res) => {
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
});

// 16. Obtener puntos actuales
app.get('/api/puntos/actual', authenticateToken, (req, res) => {
    const user_id = req.user.id;

    db.query('SELECT puntos FROM usuarios WHERE id = ?', [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.json({ puntos: results[0].puntos });
    });
});

// 11d. Obtener progreso actual (Continuar)
app.get('/api/progreso/actual', authenticateToken, (req, res) => {
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
});

// E. ADMINISTRADOR

// 12. Subir nueva seña
app.post('/api/admin/senas', authenticateAdmin, upload.single('video'), (req, res) => {
    const { palabra, categoria_id, descripcion } = req.body;
    const video_url = req.file ? req.file.path : null;

    if (!video_url) return res.status(400).json({ error: 'Video requerido' });

    const query = 'INSERT INTO senas (categoria_id, palabra, descripcion, video_url) VALUES (?, ?, ?, ?)';
    db.query(query, [categoria_id, palabra, descripcion, video_url], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ mensaje: 'Seña creada', id: result.insertId });
    });
});

// 13. Editar/Borrar seña
app.put('/api/admin/senas/:id', authenticateAdmin, (req, res) => {
    const { palabra, descripcion, categoria_id } = req.body;
    const { id } = req.params;

    const query = 'UPDATE senas SET palabra = ?, descripcion = ?, categoria_id = ? WHERE id = ?';
    db.query(query, [palabra, descripcion, categoria_id, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Seña no encontrada' });
        res.json({ mensaje: 'Seña actualizada' });
    });
});

app.delete('/api/admin/senas/:id', authenticateAdmin, (req, res) => {
    db.query('DELETE FROM senas WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Seña no encontrada' });
        res.json({ mensaje: 'Seña eliminada' });
    });
});

// 14. Estadísticas
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const stats = {};
    // Ejecutar consultas en paralelo sería mejor, aquí en serie por simplicidad
    db.query('SELECT COUNT(*) as count FROM usuarios', (err, resUser) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.total_usuarios = resUser[0].count;

        db.query('SELECT COUNT(*) as count FROM senas', (err, resSenas) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.total_senas = resSenas[0].count;

            db.query('SELECT COUNT(*) as count FROM quiz_resultados', (err, resQuiz) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.quizzes_completados = resQuiz[0].count;

                res.json(stats);
            });
        });
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});