const fs = require('fs-extra'); // npm install fs-extra
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// --- CONFIGURACIÓN ---
const SOURCE_DIR = path.join(__dirname, 'temp_recursos');
const TARGET_DIR = path.join(__dirname, 'public', 'uploads');
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Bur*Cas28',
    database: process.env.DB_NAME || 'app_lsm_db',
    port: process.env.DB_PORT || 3306
};

// --- EXTENSIONES SOPORTADAS ---
const VIDEO_EXTS = ['.mp4', '.m4v', '.mov', '.webm'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// --- UTILIDADES ---

// Limpia nombres de CATEGORÍA
// Ej: "LSM_Animales_Web" -> "Animales"
const cleanCategoryName = (name) => {
    return name
        .replace(/^LSM_/, '')      // Quita LSM_ al inicio
        .replace(/_Web$/, '')      // Quita _Web al final
        .replace(/_/g, ' ')        // Cambia guiones bajos internos por espacios
        .replace(/([A-Z])/g, ' $1') // Agrega espacio antes de mayúsculas (CamelCase -> Camel Case)
        .trim();
};

// Limpia nombres de ARCHIVO (Palabra clave)
// Ej: "Abeja_Web.m4v" -> "Abeja"
// Ej: "0.JPG" -> "0"
// Ej: "a.JPG" -> "a"
const cleanFileName = (name) => {
    let clean = name;

    // 1. Quitar sufijo _Web si existe
    clean = clean.replace(/_Web$/i, '');

    // 2. Reemplazar guiones bajos por espacios
    clean = clean.replace(/_/g, ' ');

    return clean.trim();
};

// --- SCRIPT PRINCIPAL ---
async function importData() {
    console.log('🚀 Iniciando importación inteligente...');

    const connection = await mysql.createConnection(DB_CONFIG);

    try {
        await fs.ensureDir(TARGET_DIR);
        const items = await fs.readdir(SOURCE_DIR);

        for (const folderName of items) {
            const folderPath = path.join(SOURCE_DIR, folderName);
            const stat = await fs.stat(folderPath);

            // Solo procesar si es carpeta y parece ser de contenido LSM
            if (stat.isDirectory()) {

                // A. Procesar Categoría
                const cleanCatName = cleanCategoryName(folderName);
                console.log(`\n📂 Categoría detectada: "${cleanCatName}" (Original: ${folderName})`);

                // Insertar Categoría si no existe
                const [catRows] = await connection.execute(
                    'SELECT id FROM categorias WHERE nombre = ?',
                    [cleanCatName]
                );

                let categoryId;
                if (catRows.length > 0) {
                    categoryId = catRows[0].id;
                } else {
                    const [res] = await connection.execute(
                        'INSERT INTO categorias (nombre, icon_url) VALUES (?, ?)',
                        [cleanCatName, '📁']
                    );
                    categoryId = res.insertId;
                    console.log(`   ✅ Categoría creada en BD: ID ${categoryId}`);
                }

                // Crear carpeta destino limpia
                // Usamos guiones bajos para carpetas reales para evitar problemas de URL
                const safeCatFolder = cleanCatName.replace(/\s+/g, '_');
                const targetCatPath = path.join(TARGET_DIR, safeCatFolder);
                await fs.ensureDir(targetCatPath);

                // B. Procesar Archivos (Señas) dentro de la carpeta
                const files = await fs.readdir(folderPath);
                const wordMap = new Map();

                // 1. Agrupar archivos por palabra
                for (const fileName of files) {
                    if (fileName.startsWith('.')) continue;

                    const fileExt = path.extname(fileName).toLowerCase();
                    const nameWithoutExt = path.basename(fileName, path.extname(fileName));

                    const isVideo = VIDEO_EXTS.includes(fileExt);
                    const isImage = IMAGE_EXTS.includes(fileExt);

                    if (!isVideo && !isImage) continue;

                    const cleanWord = cleanFileName(nameWithoutExt);

                    if (!wordMap.has(cleanWord)) {
                        wordMap.set(cleanWord, { video: null, image: null });
                    }

                    if (isVideo) wordMap.get(cleanWord).video = fileName;
                    if (isImage) wordMap.get(cleanWord).image = fileName;
                }

                // 2. Procesar cada palabra
                for (const [cleanWord, assets] of wordMap) {
                    // Si no hay video, y la BD lo requiere, no podemos insertar NUEVO registro sin video.
                    // Pero si ya existe, podríamos querer actualizar la imagen.
                    // Por ahora, intentaremos insertar si tenemos video, o actualizar si existe.

                    const [wordRows] = await connection.execute(
                        'SELECT id, video_url FROM senas WHERE palabra = ? AND categoria_id = ?',
                        [cleanWord, categoryId]
                    );

                    let signId;
                    let isNew = false;

                    if (wordRows.length > 0) {
                        signId = wordRows[0].id;
                    } else {
                        // Es nuevo.
                        // YA NO REQUERIMOS VIDEO OBLIGATORIO (Para casos como Abecedario que solo tienen imagen)
                        /*
                        if (!assets.video) {
                            console.log(`   ⚠️ [${cleanWord}] -> Saltado: No tiene video y es registro nuevo.`);
                            continue;
                        }
                        */
                        isNew = true;
                    }

                    // Preparar URLs
                    let videoDbUrl = null;
                    let imageDbUrl = null;

                    if (assets.video) {
                        const newVideoName = `${cleanWord.replace(/\s+/g, '_')}${path.extname(assets.video)}`;
                        const destVideoPath = path.join(targetCatPath, newVideoName);
                        await fs.copy(path.join(folderPath, assets.video), destVideoPath);
                        videoDbUrl = `/uploads/${safeCatFolder}/${newVideoName}`;
                    }

                    if (assets.image) {
                        const newImageName = `${cleanWord.replace(/\s+/g, '_')}${path.extname(assets.image)}`;
                        const destImagePath = path.join(targetCatPath, newImageName);
                        await fs.copy(path.join(folderPath, assets.image), destImagePath);
                        imageDbUrl = `/uploads/${safeCatFolder}/${newImageName}`;
                    }

                    // Ejecutar DB
                    if (isNew) {
                        await connection.execute(
                            'INSERT INTO senas (categoria_id, palabra, video_url, imagen_url) VALUES (?, ?, ?, ?)',
                            [categoryId, cleanWord, videoDbUrl, imageDbUrl]
                        );
                        console.log(`   ✨ [${cleanWord}] -> Nueva seña creada.`);
                    } else {
                        // Actualizar campos si tenemos nuevos archivos
                        const updates = [];
                        const params = [];

                        if (videoDbUrl) {
                            updates.push('video_url = ?');
                            params.push(videoDbUrl);
                        }
                        if (imageDbUrl) {
                            updates.push('imagen_url = ?');
                            params.push(imageDbUrl);
                        }

                        if (updates.length > 0) {
                            params.push(signId);
                            await connection.execute(`UPDATE senas SET ${updates.join(', ')} WHERE id = ?`, params);
                            console.log(`   🔄 [${cleanWord}] -> Actualizado.`);
                        }
                    }
                }
            }
        }

        console.log('\n🏁 ¡PROCESO COMPLETADO! Todos los archivos han sido organizados.');

    } catch (error) {
        console.error('❌ Error fatal:', error);
    } finally {
        await connection.end();
    }
}

importData();