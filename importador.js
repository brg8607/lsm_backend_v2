const fs = require('fs-extra');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// --- CONFIGURACIÓN ---
// Usamos path.resolve para obtener la ruta absoluta y evitar dudas
const SCAN_DIR = path.resolve(__dirname, 'public', 'uploads');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: 'Bur*Cas28',
    database: 'app_lsm_db'
};

// Extensiones permitidas
const VIDEO_EXTS = ['.mp4', '.m4v', '.mov', '.webm'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function syncDatabase() {
    console.log('---------------------------------------------------');
    console.log(`📍 Directorio de trabajo actual: ${process.cwd()}`);
    console.log(`📂 Buscando archivos en:         ${SCAN_DIR}`);
    console.log('---------------------------------------------------');

    const connection = await mysql.createConnection(DB_CONFIG);

    try {
        // 1. Verificar que la carpeta public/uploads existe
        if (!await fs.pathExists(SCAN_DIR)) {
            console.error(`\n❌ ERROR CRÍTICO: La carpeta no existe.`);
            console.error(`   El script está buscando aquí: ${SCAN_DIR}`);
            console.error(`   Por favor verifica que tengas la carpeta 'public' y dentro 'uploads'.`);
            process.exit(1);
        }

        console.log('✅ Carpeta encontrada. Iniciando escaneo...\n');

        // 2. Leer las carpetas de Categorías
        const categories = await fs.readdir(SCAN_DIR);

        for (const catName of categories) {
            const catPath = path.join(SCAN_DIR, catName);
            const stat = await fs.stat(catPath);

            if (stat.isDirectory()) {
                console.log(`📂 Categoría: ${catName}`);

                // A. Obtener o Crear ID de Categoría
                const [catRows] = await connection.execute(
                    'SELECT id FROM categorias WHERE nombre = ?',
                    [catName]
                );

                let categoryId;
                if (catRows.length > 0) {
                    categoryId = catRows[0].id;
                } else {
                    const [res] = await connection.execute(
                        'INSERT INTO categorias (nombre, icon_url) VALUES (?, ?)',
                        [catName, '📁']
                    );
                    categoryId = res.insertId;
                    console.log(`   ➕ Categoría creada en BD`);
                }

                // B. Leer archivos
                const files = await fs.readdir(catPath);

                for (const fileName of files) {
                    if (fileName.startsWith('.')) continue;

                    const fileExt = path.extname(fileName).toLowerCase();
                    const wordName = path.basename(fileName, fileExt);

                    // URL Web (relativa)
                    const dbUrl = `/uploads/${catName}/${fileName}`;

                    const isVideo = VIDEO_EXTS.includes(fileExt);
                    const isImage = IMAGE_EXTS.includes(fileExt);

                    if (!isVideo && !isImage) continue;

                    // C. Actualizar o Insertar
                    const [senaRows] = await connection.execute(
                        'SELECT id FROM senas WHERE palabra = ? AND categoria_id = ?',
                        [wordName, categoryId]
                    );

                    if (senaRows.length > 0) {
                        const senaId = senaRows[0].id;
                        if (isVideo) {
                            await connection.execute('UPDATE senas SET video_url = ? WHERE id = ?', [dbUrl, senaId]);
                            console.log(`   📹 Video -> ${wordName}`);
                        } else if (isImage) {
                            await connection.execute('UPDATE senas SET imagen_url = ? WHERE id = ?', [dbUrl, senaId]);
                            console.log(`   🖼️ Imagen -> ${wordName}`);
                        }
                    } else {
                        let videoUrl = null;
                        let imgUrl = null;
                        if (isVideo) videoUrl = dbUrl;
                        else if (isImage) imgUrl = dbUrl;

                        await connection.execute(
                            'INSERT INTO senas (categoria_id, palabra, video_url, imagen_url) VALUES (?, ?, ?, ?)',
                            [categoryId, wordName, videoUrl, imgUrl]
                        );
                        console.log(`   ✨ Nueva -> ${wordName}`);
                    }
                }
            }
        }

        console.log('\n🏁 ¡LISTO! Base de datos sincronizada.');

    } catch (error) {
        console.error('❌ Error inesperado:', error);
    } finally {
        await connection.end();
    }
}

syncDatabase();