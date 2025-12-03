const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    try {
        const dbUrl = process.env.JAWSDB_URL || process.env.DATABASE_URL;
        
        if (!dbUrl) {
            console.error('No database URL found');
            process.exit(1);
        }

        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbUrl);
        console.log('Connected successfully!');

        // Read and execute SQL file
        const fs = require('fs');
        const sql = fs.readFileSync('./heroku_setup.sql', 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.substring(0, 50) + '...');
                await connection.query(statement);
            }
        }
        
        console.log('Database setup completed successfully!');
        
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupDatabase();
