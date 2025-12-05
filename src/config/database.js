const mysql = require('mysql2');
require('dotenv').config();

// Conexión a Base de Datos
let db;
if (process.env.JAWSDB_URL) {
    // Heroku JawsDB connection
    db = mysql.createConnection(process.env.JAWSDB_URL);
} else {
    // Local development
    db = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'app_lsm_db',
        port: process.env.DB_PORT || 3306
    });
}

db.connect(err => {
    if (err) {
        console.error('Error conectando a la BD:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

module.exports = db;
