const fs = require('fs-extra');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// --- CONFIGURACIÓN ---
const SCAN_DIR = path.join(__dirname, 'public', 'uploads');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: 'Bur*Cas28',
    database: 'app_lsm_db'
};

const VIDEO_EXTS = ['.mp4', '.m4v', '.mov', '.webm'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function repararBaseDeDatos() {
    console.log('\n🛠️  INICIANDO REPARACIÓN DE BASE DE DATOS (V2) 🛠️');
    console.log('------------------------------------------------');

    if (!await fs.pathExists(SCAN_DIR)) {
        console.error(`❌ ERROR: No encuentro la carpeta 'public/uploads'.`);
        return;
    }

    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conectado a la Base de Datos.');

    try {
        console.log('🧹 Limpiando tabla de señas...');
        await connection.execute('TRUNCATE TABLE senas');

        const categories = await fs.readdir(SCAN_DIR);

        for (const catName of categories) {
            const catPath = path.join(SCAN_DIR, catName);
            const stat = await fs.stat(catPath);

            if (stat.isDirectory()) {
                // 1. Obtener/Crear Categoría
                const [catRows] = await connection.execute('SELECT id FROM categorias WHERE nombre = ?', [catName]);
                let categoryId;

                if (catRows.length > 0) {
                    categoryId = catRows[0].id;
                } else {
                    const [res] = await connection.execute('INSERT INTO categorias (nombre, icon_url) VALUES (?, ?)', [catName, '📁']);
                    categoryId = res.insertId;
                }

                // 2. Procesar Archivos
                const files = await fs.readdir(catPath);

                for (const fileName of files) {
                    if (fileName.startsWith('.')) continue;

                    const fileExt = path.extname(fileName); // Extensión original (.JPG o .jpg)
                    // CORRECCIÓN: Usamos la extensión exacta para removerla del nombre
                    const wordName = path.basename(fileName, fileExt);
                    const dbUrl = `/uploads/${catName}/${fileName}`;

                    const extLower = fileExt.toLowerCase();
                    const isVideo = VIDEO_EXTS.includes(extLower);
                    const isImage = IMAGE_EXTS.includes(extLower);

                    if (!isVideo && !isImage) continue;

                    // Insertar o actualizar
                    const [senaRows] = await connection.execute(
                        'SELECT id FROM senas WHERE palabra = ? AND categoria_id = ?',
                        [wordName, categoryId]
                    );

                    if (senaRows.length > 0) {
                        const senaId = senaRows[0].id;
                        if (isVideo) {
                            await connection.execute('UPDATE senas SET video_url = ? WHERE id = ?', [dbUrl, senaId]);
                            console.log(`   📹 [${wordName}] Video actualizado`);
                        } else if (isImage) {
                            await connection.execute('UPDATE senas SET imagen_url = ? WHERE id = ?', [dbUrl, senaId]);
                            console.log(`   🖼️ [${wordName}] Imagen actualizada`);
                        }
                    } else {
                        const videoUrl = isVideo ? dbUrl : null;
                        const imgUrl = isImage ? dbUrl : null;
                        await connection.execute(
                            'INSERT INTO senas (categoria_id, palabra, video_url, imagen_url) VALUES (?, ?, ?, ?)',
                            [categoryId, wordName, videoUrl, imgUrl]
                        );
                        console.log(`   ✨ [${wordName}] Creada (${isVideo ? 'Video' : 'Imagen'})`);
                    }
                }
            }
        }
        console.log('\n✅ ¡BASE DE DATOS LIMPIA Y REPARADA!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

repararBaseDeDatos();