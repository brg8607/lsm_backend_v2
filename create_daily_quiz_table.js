const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'app_lsm_db',
    port: process.env.DB_PORT || 3306
});

db.connect(err => {
    if (err) {
        console.error('Error conectando:', err);
        process.exit(1);
    }
    console.log('Conectado a MySQL');

    const query = `
        CREATE TABLE IF NOT EXISTS quiz_diario_completado (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            fecha DATE NOT NULL,
            puntuacion INT NOT NULL,
            completado BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_date (user_id, fecha)
        );
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error creando tabla:', err);
            process.exit(1);
        } else {
            console.log('Tabla quiz_diario_completado creada/verificada exitosamente');
        }
        db.end();
    });
});
