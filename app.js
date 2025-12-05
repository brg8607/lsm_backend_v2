const express = require('express');
const cors = require('cors');
const path = require('path');

const logger = require('./src/middlewares/logger');

// Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const categoriasRoutes = require('./src/routes/categorias.routes');
const senasRoutes = require('./src/routes/senas.routes');
const cursosRoutes = require('./src/routes/cursos.routes');
const puntosRoutes = require('./src/routes/puntos.routes');
const rachaRoutes = require('./src/routes/racha.routes');
const quizRoutes = require('./src/routes/quiz.routes');
const progresoRoutes = require('./src/routes/progreso.routes');
const adminRoutes = require('./src/routes/admin.routes');

const app = express();

// --- CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); // Servir archivos estáticos desde public/uploads

// --- LOGGING MIDDLEWARE ---
app.use(logger);

// --- ENDPOINTS ---

// Ruta raíz con página de bienvenida
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LSM Backend API</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 800px;
                    padding: 40px;
                    text-align: center;
                }
                h1 { color: #667eea; font-size: 2.5em; margin-bottom: 10px; }
                .subtitle { color: #666; font-size: 1.2em; margin-bottom: 30px; }
                .status {
                    background: #10b981;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 50px;
                    display: inline-block;
                    margin-bottom: 30px;
                    font-weight: bold;
                }
                .endpoints {
                    background: #f7fafc;
                    border-radius: 10px;
                    padding: 20px;
                    margin-top: 20px;
                    text-align: left;
                }
                .endpoints h2 { color: #667eea; margin-bottom: 15px; font-size: 1.3em; }
                .endpoint {
                    background: white;
                    padding: 12px;
                    margin: 8px 0;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9em;
                }
                .method { 
                    color: #10b981; 
                    font-weight: bold; 
                    margin-right: 10px;
                }
                .method.post { color: #f59e0b; }
                .method.delete { color: #ef4444; }
                .footer {
                    margin-top: 30px;
                    color: #999;
                    font-size: 0.9em;
                }
                a { color: #667eea; text-decoration: none; font-weight: bold; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤟 LSM Backend API</h1>
                <p class="subtitle">Lengua de Señas Mexicano</p>
                <div class="status">✓ API Online</div>
                
                <div class="endpoints">
                    <h2>📍 Endpoints Disponibles</h2>
                    <div class="endpoint"><span class="method post">POST</span> /api/auth/register</div>
                    <div class="endpoint"><span class="method post">POST</span> /api/login</div>
                    <div class="endpoint"><span class="method">GET</span> /api/categorias</div>
                    <div class="endpoint"><span class="method">GET</span> /api/categorias/:id/senas</div>
                    <div class="endpoint"><span class="method">GET</span> /api/perfil</div>
                    <div class="endpoint"><span class="method">GET</span> /api/quiz-diario</div>
                    <div class="endpoint"><span class="method post">POST</span> /api/admin/categorias</div>
                    <div class="endpoint"><span class="method post">POST</span> /api/admin/senas</div>
                </div>

                <div class="footer">
                    <p>Hosted on Render • Database on Aiven</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/senas', senasRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/puntos', puntosRoutes);
app.use('/api', rachaRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progreso', progresoRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;