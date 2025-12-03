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

    const query = "ALTER TABLE usuarios ADD COLUMN puntos INT DEFAULT 0;";
    db.query(query, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Columna puntos ya existe');
            } else {
                console.error('Error alterando tabla:', err);
                process.exit(1);
            }
        } else {
            console.log('Tabla alterada exitosamente');
        }
        db.end();
    });
});
