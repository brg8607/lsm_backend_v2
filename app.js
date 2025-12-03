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

// G. QUIZ DIARIO

// 17. Completar quiz diario
app.post('/api/quiz/diario/completar', authenticateToken, (req, res) => {
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
});

// 18. Verificar estado del quiz diario
app.get('/api/quiz/diario/estado', authenticateToken, (req, res) => {
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
});

// H. SISTEMA DE RACHAS

// 19. Registrar sesión diaria
app.post('/api/sesion/registrar', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    const hoy = new Date().toISOString().split('T')[0];

    // UPSERT: Insertar solo si no existe para hoy
    const query = `
        INSERT INTO sesiones_diarias (user_id, fecha)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE fecha = fecha
    `;

    db.query(query, [user_id, hoy], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            mensaje: 'Sesión registrada',
            fecha: hoy
        });
    });
});

// 20. Obtener racha actual
app.get('/api/racha/actual', authenticateToken, (req, res) => {
    const user_id = req.user.id;

    // Obtener todas las fechas de sesiones del usuario, ordenadas DESC
    const query = `
        SELECT fecha 
        FROM sesiones_diarias 
        WHERE user_id = ?
        ORDER BY fecha DESC
    `;

    db.query(query, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.json({
                racha_actual: 0,
                ultima_sesion: null,
                racha_maxima: 0
            });
        }

        // Convertir fechas a objetos Date
        const fechas = results.map(r => new Date(r.fecha));
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Calcular racha actual
        let rachaActual = 0;
        let rachaMaxima = 0;
        let rachaTemp = 0;

        // Verificar si abrió hoy o ayer para iniciar el contador
        const ultimaFecha = fechas[0];
        ultimaFecha.setHours(0, 0, 0, 0);

        const diffDias = Math.floor((hoy - ultimaFecha) / (1000 * 60 * 60 * 24));

        if (diffDias > 1) {
            // Si la última sesión fue hace más de 1 día, la racha se rompió
            rachaActual = 0;
        } else {
            // Contar racha actual desde hoy/ayer hacia atrás
            let fechaEsperada = new Date(hoy);
            if (diffDias === 1) {
                // Si no abrió hoy, empezar desde ayer
                fechaEsperada.setDate(fechaEsperada.getDate() - 1);
            }

            for (let i = 0; i < fechas.length; i++) {
                const fechaActual = new Date(fechas[i]);
                fechaActual.setHours(0, 0, 0, 0);

                if (fechaActual.getTime() === fechaEsperada.getTime()) {
                    rachaActual++;
                    rachaTemp++;
                    // Siguiente día esperado es un día antes
                    fechaEsperada.setDate(fechaEsperada.getDate() - 1);
                } else {
                    // Se rompió la racha
                    break;
                }
            }
        }

        // Calcular racha máxima histórica
        rachaTemp = 1;
        for (let i = 0; i < fechas.length - 1; i++) {
            const fecha1 = new Date(fechas[i]);
            const fecha2 = new Date(fechas[i + 1]);
            fecha1.setHours(0, 0, 0, 0);
            fecha2.setHours(0, 0, 0, 0);

            const diff = Math.floor((fecha1 - fecha2) / (1000 * 60 * 60 * 24));

            if (diff === 1) {
                // Días consecutivos
                rachaTemp++;
                rachaMaxima = Math.max(rachaMaxima, rachaTemp);
            } else {
                // Se rompe la racha
                rachaTemp = 1;
            }
        }
        rachaMaxima = Math.max(rachaMaxima, rachaTemp, rachaActual);

        res.json({
            racha_actual: rachaActual,
            ultima_sesion: results[0].fecha,
            racha_maxima: rachaMaxima
        });
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

// 14. Estadísticas generales del sistema
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const stats = {};

    // 1. Total de usuarios
    db.query('SELECT COUNT(*) as count FROM usuarios', (err, resUser) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.total_usuarios = resUser[0].count;

        // 2. Usuarios activos (con al menos una sesión en los últimos 30 días)
        const treintaDiasAtras = new Date();
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
        const fechaLimite = treintaDiasAtras.toISOString().split('T')[0];

        db.query(
            'SELECT COUNT(DISTINCT user_id) as count FROM sesiones_diarias WHERE fecha >= ?',
            [fechaLimite],
            (err, resActivos) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.usuarios_activos = resActivos[0].count;

                // 3. Usuarios que completaron todas las categorías
                db.query(`
                    SELECT COUNT(*) as count FROM (
                        SELECT p.user_id, COUNT(DISTINCT p.categoria_id) as categorias_completadas
                        FROM progreso_quiz p
                        WHERE p.completado = TRUE
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

                            // 6. Usuario con mayor racha - OPTIMIZADO
                            db.query(`
                                SELECT u.nombre, u.racha_dias
                                FROM usuarios u
                                WHERE u.racha_dias = (SELECT MAX(racha_dias) FROM usuarios WHERE racha_dias > 0)
                                LIMIT 1
                            `, (err, topRachaResults) => {
                                if (err) return res.status(500).json({ error: err.message });

                                // Si existe un usuario con racha, incluirlo; si no, null
                                stats.usuario_top_racha = topRachaResults.length > 0 && topRachaResults[0].racha_dias > 0
                                    ? {
                                        nombre: topRachaResults[0].nombre,
                                        racha_dias: topRachaResults[0].racha_dias
                                    }
                                    : null;

                                // Retornar todas las estadísticas
                                res.json(stats);
                            });
                        });
                    });
                });
            }
        );
    });
});

// 15. Listar todos los usuarios con progreso
app.get('/api/admin/stats/users', authenticateAdmin, (req, res) => {
    const query = `
        SELECT 
            u.id,
            u.nombre,
            u.correo,
            u.tipo_usuario,
            u.fecha_registro,
            COUNT(DISTINCT qr.id) as quizzes_completados,
            AVG(COALESCE(pu.porcentaje_completado, 0)) as progreso_promedio,
            MAX(qr.fecha_realizacion) as ultima_actividad
        FROM usuarios u
        LEFT JOIN quiz_resultados qr ON u.id = qr.usuario_id
        LEFT JOIN progreso_usuario pu ON u.id = pu.usuario_id
        GROUP BY u.id, u.nombre, u.correo, u.tipo_usuario, u.fecha_registro
        ORDER BY u.fecha_registro DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 16. Progreso detallado de un usuario específico
app.get('/api/admin/stats/progress/:userId', authenticateAdmin, (req, res) => {
    const userId = req.params.userId;

    // Obtener información del usuario
    db.query('SELECT id, nombre, correo, tipo_usuario, fecha_registro FROM usuarios WHERE id = ?', [userId], (err, userResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (userResults.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const usuario = userResults[0];

        // Obtener progreso por categoría
        const queryProgreso = `
    SELECT 
        c.id as categoria_id,
        c.nombre as categoria_nombre,
        c.icon_url,
        COALESCE(pq.porcentaje_completado, 0) as porcentaje_completado,
        pq.ultimo_acceso,
        pq.nivel,
        pq.indice_pregunta,
        pq.completado
    FROM categorias c
    LEFT JOIN (
        SELECT DISTINCT categoria_id, 
               porcentaje_completado, 
               ultimo_acceso, 
               nivel, 
               indice_pregunta, 
               completado
        FROM progreso_quiz
        WHERE user_id = ?
        GROUP BY categoria_id
    ) pq ON c.id = pq.categoria_id
    ORDER BY c.id ASC
`;

        db.query(queryProgreso, [userId, userId], (err, progresoResults) => {
            if (err) return res.status(500).json({ error: err.message });

            // Obtener historial de quizzes
            const queryQuizzes = `
                SELECT 
                    qr.id,
                    qr.quiz_id,
                    qr.puntaje,
                    qr.fecha_realizacion,
                    q.titulo
                FROM quiz_resultados qr
                LEFT JOIN quizzes q ON qr.quiz_id = q.id
                WHERE qr.usuario_id = ?
                ORDER BY qr.fecha_realizacion DESC
                LIMIT 20
            `;

            db.query(queryQuizzes, [userId], (err, quizzesResults) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    usuario: usuario,
                    progreso_categorias: progresoResults,
                    historial_quizzes: quizzesResults,
                    resumen: {
                        total_categorias: progresoResults.length,
                        categorias_completadas: progresoResults.filter(p => p.completado).length,
                        quizzes_realizados: quizzesResults.length,
                        promedio_puntaje: quizzesResults.length > 0
                            ? (quizzesResults.reduce((sum, q) => sum + q.puntaje, 0) / quizzesResults.length).toFixed(2)
                            : 0
                    }
                });
            });
        });
    });
});

// 17. Crear nueva categoría
app.post('/api/admin/categorias', authenticateAdmin, (req, res) => {
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
});

// 18. Editar categoría
app.put('/api/admin/categorias/:id', authenticateAdmin, (req, res) => {
    const { nombre, icon_url, descripcion } = req.body;
    const { id } = req.params;

    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const query = 'UPDATE categorias SET nombre = ?, icon_url = ?, descripcion = ? WHERE id = ?';
    db.query(query, [nombre, icon_url || null, descripcion || null, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ mensaje: 'Categoría actualizada exitosamente' });
    });
});

// 19. Eliminar categoría
app.delete('/api/admin/categorias/:id', authenticateAdmin, (req, res) => {
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
});

// 20. Listar todos los quizzes
app.get('/api/admin/quiz', authenticateAdmin, (req, res) => {
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
});

// 21. Eliminar quiz
app.delete('/api/admin/quiz/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;

    // Las preguntas se eliminan automáticamente por CASCADE
    db.query('DELETE FROM quizzes WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Quiz no encontrado' });
        res.json({ mensaje: 'Quiz eliminado exitosamente' });
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});