-- 1.1 CREACIÓN DE BASE DE DATOS
CREATE DATABASE IF NOT EXISTS app_lsm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE app_lsm_db;

-- 1.2 TABLA DE USUARIOS
-- Almacena información de registro y tipo de acceso.
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255), -- Puede ser NULL si entra con Google/Invitado
    google_uid VARCHAR(150) UNIQUE, -- ID único de Google
    tipo_usuario ENUM('normal', 'invitado', 'admin') DEFAULT 'normal',
    avatar_url VARCHAR(255) DEFAULT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.3 TABLA DE CATEGORÍAS
-- Estructura para las carpetas de contenido.
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    icon_url VARCHAR(255), -- Emoji o URL de icono
    descripcion TEXT
);

-- 1.4 TABLA DE SEÑAS (DICCIONARIO)
-- El contenido principal: videos y definiciones.
CREATE TABLE IF NOT EXISTS senas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria_id INT NOT NULL,
    palabra VARCHAR(100) NOT NULL,
    descripcion TEXT, -- Explicación de cómo hacer la seña
    video_url VARCHAR(255) NOT NULL, -- URL local o en nube (AWS/Firebase)
    audio_url VARCHAR(255), -- Opcional: pronunciación
    imagen_url VARCHAR(255), -- Opcional: miniatura
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
);

-- 1.5 TABLA DE QUIZZES (ACTIVIDAD DIARIA)
-- Controla qué quiz aparece cada día.
CREATE TABLE IF NOT EXISTS quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150),
    fecha_programada DATE UNIQUE, -- Solo un quiz por día
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.6 TABLA DE PREGUNTAS DEL QUIZ
CREATE TABLE IF NOT EXISTS quiz_preguntas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    pregunta_texto VARCHAR(255) NOT NULL,
    video_asociado_url VARCHAR(255), -- Video que el usuario debe identificar
    opcion_correcta VARCHAR(100) NOT NULL,
    opcion_incorrecta1 VARCHAR(100) NOT NULL,
    opcion_incorrecta2 VARCHAR(100) NOT NULL,
    opcion_incorrecta3 VARCHAR(100) NOT NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- 1.7 TABLA DE RESULTADOS DE QUIZ
-- Historial de puntajes de los usuarios.
CREATE TABLE IF NOT EXISTS quiz_resultados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    quiz_id INT NOT NULL,
    puntaje INT NOT NULL, -- Ej: 80 sobre 100
    fecha_realizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- 1.8 TABLA DE PROGRESO DE USUARIO
-- Rastrea qué categorías ha completado el usuario.
CREATE TABLE IF NOT EXISTS progreso_usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    categoria_id INT NOT NULL,
    porcentaje_completado INT DEFAULT 0, -- 0 a 100
    ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
    UNIQUE KEY unique_progreso (usuario_id, categoria_id) -- Evita duplicados
);

-- 1.9 CARGA INICIAL DE DATOS (Tus Categorías Reales)
-- Limpiamos tabla categorias para evitar duplicados si se corre varias veces (opcional, cuidado en prod)
-- TRUNCATE TABLE categorias; 

INSERT INTO categorias (nombre, icon_url) VALUES 
('Abecedario', '🅰️'),
('Animales', '🐶'),
('Colores', '🎨'),
('Comida', '🌮'),
('Cuerpo', '👂'),
('Días de la Semana', '📅'),
('Frutas', '🍎'),
('Hogar', '🏠'),
('Lugares', '📍'),
('Meses del Año', '📆'),
('Números', '🔢'),
('Personas', '👥'),
('Preguntas', '❓'),
('Gramática (Adj/Prep)', '📚'),
('Pronombres', '👉'),
('Profesiones', '👮'),
('Ropa', '👕'),
('Saludos', '👋'),
('Tiempo', '⏰'),
('Transporte', '🚗'),
('Verbos Comunes', '🏃'),
('Verbos Narrativos', '📖'),
('Verduras', '🥦')
ON DUPLICATE KEY UPDATE icon_url=VALUES(icon_url);
