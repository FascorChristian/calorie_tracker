-- =============================================================================
-- NutriVoice AI - Esquema de Base de Datos MySQL
-- =============================================================================

-- 1. Crear Base de Datos
CREATE DATABASE IF NOT EXISTS calorie_tracker 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE calorie_tracker;

-- 2. Tabla de Usuarios (Perfil Biométrico y Objetivos)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender ENUM('masculino', 'femenino', 'otro') NOT NULL,
    weight_kg DECIMAL(5,2) NOT NULL,
    height_cm DECIMAL(5,2) NOT NULL,
    activity_level VARCHAR(30) NOT NULL,
    goal VARCHAR(30) NOT NULL,
    target_calories INT NOT NULL,
    target_protein_g INT NOT NULL,
    target_carbs_g INT NOT NULL,
    target_fat_g INT NOT NULL,
    allergies JSON NULL,              -- Ejemplo: ["Lactosa moderada"]
    dietary_preferences JSON NULL,    -- Ejemplo: ["Alto en proteína", "Comida real"]
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Tabla de Comidas Registradas (Multimodal: Foto + Audio + IA)
CREATE TABLE IF NOT EXISTS meals (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    meal_date DATE NOT NULL,
    meal_time VARCHAR(10) NOT NULL,   -- "08:30", "13:45"
    meal_type ENUM('desayuno', 'almuerzo', 'cena', 'snack') NOT NULL,
    image_url LONGTEXT NULL,          -- URL o string Base64 de la imagen
    audio_data_url LONGTEXT NULL,     -- String Base64 del audio grabado
    audio_duration_seconds INT DEFAULT 0,
    audio_transcript TEXT NULL,
    nombre_plato VARCHAR(255) NOT NULL,
    calorias_estimadas INT NOT NULL,
    proteinas DECIMAL(5,1) NOT NULL,
    carbohidratos DECIMAL(5,1) NOT NULL,
    grasas DECIMAL(5,1) NOT NULL,
    fibra DECIMAL(5,1) NULL,
    puntaje_plato DECIMAL(3,1) NOT NULL,  -- Rango 1.0 a 10.0
    feedback_breve TEXT NULL,
    ingredientes_detectados JSON NULL,    -- Lista JSON de ingredientes
    detalles_audio TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, meal_date)
);

-- 4. Tabla de Resúmenes Diarios (Evaluación Global del Día)
CREATE TABLE IF NOT EXISTS daily_summaries (
    id VARCHAR(60) PRIMARY KEY,           -- Convención: CONCAT(user_id, '_', summary_date)
    user_id VARCHAR(36) NOT NULL,
    summary_date DATE NOT NULL,
    total_calories INT NOT NULL,
    total_protein DECIMAL(5,1) NOT NULL,
    total_carbs DECIMAL(5,1) NOT NULL,
    total_fat DECIMAL(5,1) NOT NULL,
    puntaje_diario INT NOT NULL,          -- Rango 1 a 100
    consejo_diario TEXT NOT NULL,
    balance_nutricional VARCHAR(100) NOT NULL,
    puntos_fuertes JSON NULL,             -- Lista JSON de fortalezas
    areas_de_mejora JSON NULL,            -- Lista JSON de mejoras recomendadas
    meals_count INT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_date (user_id, summary_date)
);

-- =============================================================================
-- 5. Datos Iniciales (Semillas / Seeds)
-- =============================================================================

-- Usuario por defecto
INSERT INTO users (
    id, name, age, gender, weight_kg, height_cm, 
    activity_level, goal, target_calories, target_protein_g, 
    target_carbs_g, target_fat_g, allergies, dietary_preferences, notes
) VALUES (
    'user_default', 'Christian Díaz', 28, 'masculino', 78.00, 178.00,
    'moderado', 'deficit', 2150, 160, 200, 65,
    '["Lactosa moderada"]', '["Alto en proteína", "Comida real"]',
    'Entrenamiento de fuerza 4x por semana. Buscando definición muscular preservando masa magra.'
) ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Comidas de prueba para la fecha actual
INSERT INTO meals (
    id, user_id, meal_date, meal_time, meal_type, image_url,
    nombre_plato, calorias_estimadas, proteinas, carbohidratos, grasas, fibra,
    puntaje_plato, feedback_breve, ingredientes_detectados, detalles_audio
) VALUES 
(
    'meal_seed_1',
    'user_default',
    CURDATE(),
    '08:30',
    'desayuno',
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    'Omelette de 3 Huevos con Espinacas, Champiñones y Tostadas Integrales',
    460,
    32.0,
    36.0,
    20.0,
    6.0,
    9.2,
    'Excelente desayuno alto en proteína biodisponible y micronutrientes. Gran inicio para control de saciedad en déficit.',
    '["3 huevos enteros camperos", "Espinacas salteadas (50g)", "Champiñones (40g)", "2 rebanadas pan integral de centeno", "1 cucharadita de aceite de oliva virgen extra"]',
    'Mencionó haber usado 1 cucharadita medida de AOVE y sin quesos añadidos por intolerancia a la lactosa.'
),
(
    'meal_seed_2',
    'user_default',
    CURDATE(),
    '13:45',
    'almuerzo',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    'Bowl de Salmón a la Plancha con Quinoa, Aguacate y Ensalada Verde',
    680,
    46.0,
    52.0,
    28.0,
    9.0,
    9.4,
    'Aporte sobresaliente de ácidos grasos Omega-3 y carbohidratos complejos. Muy alineado con recuperación muscular.',
    '["Salmón a la plancha (200g)", "Quinoa cocida (140g)", "Medio aguacate Hass (80g)", "Mix de hojas verdes con pepino y tomate cherry", "Vinagreta de limón y mostaza Dijon"]',
    'Detalló que el salmón se cocinó sin aceite añadido ya que aprovechó su propia grasa natural.'
) ON DUPLICATE KEY UPDATE nombre_plato = VALUES(nombre_plato);

-- Resumen diario inicial para hoy
INSERT INTO daily_summaries (
    id, user_id, summary_date, total_calories, total_protein, total_carbs, total_fat,
    puntaje_diario, consejo_diario, balance_nutricional, puntos_fuertes, areas_de_mejora, meals_count
) VALUES (
    CONCAT('user_default_', CURDATE()),
    'user_default',
    CURDATE(),
    1140,
    78.0,
    88.0,
    48.0,
    91,
    'Vas a mitad del día con excelente adhesión al déficit y densidad proteica. Planifica una cena ligera con 35-40g de proteína magra para cerrar en tu meta de 2150 kcal.',
    'Excelente (Progresión Óptima)',
    '["Proteína de alto valor biológico en desayuno y almuerzo (78g acumulados).", "Grasas saludables mono y poliinsaturadas (Omega-3 de salmón y aguacate).", "Control impecable de aceites de cocina reportados con precisión por voz."]',
    '["Recuerda hidratación constante (mínimo 2.5L de agua).", "Cena recomendada: Pechuga de pavo o pescado blanco con verduras al vapor."]',
    2
) ON DUPLICATE KEY UPDATE puntaje_diario = VALUES(puntaje_diario);

