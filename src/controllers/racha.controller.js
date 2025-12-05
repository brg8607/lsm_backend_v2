const db = require('../config/database');

// Registrar sesión diaria
const registrarSesion = (req, res) => {
    const user_id = req.user.id;
    const hoy = new Date().toISOString().split('T')[0];

    // UPSERT: Insertar solo si no existe para hoy
    const query = `
        INSERT INTO sesiones_diarias (user_id, fecha)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE fecha = fecha
    `;

    db.query(query, [user_id, hoy], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            mensaje: 'Sesión registrada',
            fecha: hoy
        });
    });
};

// Obtener racha actual
const getRachaActual = (req, res) => {
    const user_id = req.user.id;

    // Obtener todas las fechas de sesiones del usuario, ordenadas DESC
    const query = `
        SELECT fecha 
        FROM sesiones_diarias 
        WHERE user_id = ?
        ORDER BY fecha DESC
    `;

    db.query(query, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.json({
                racha_actual: 0,
                ultima_sesion: null,
                racha_maxima: 0
            });
        }

        // Convertir fechas a objetos Date
        const fechas = results.map(r => new Date(r.fecha));
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Calcular racha actual
        let rachaActual = 0;
        let rachaMaxima = 0;
        let rachaTemp = 0;

        // Verificar si abrió hoy o ayer para iniciar el contador
        const ultimaFecha = fechas[0];
        ultimaFecha.setHours(0, 0, 0, 0);

        const diffDias = Math.floor((hoy - ultimaFecha) / (1000 * 60 * 60 * 24));

        if (diffDias > 1) {
            // Si la última sesión fue hace más de 1 día, la racha se rompió
            rachaActual = 0;
        } else {
            // Contar racha actual desde hoy/ayer hacia atrás
            let fechaEsperada = new Date(hoy);
            if (diffDias === 1) {
                // Si no abrió hoy, empezar desde ayer
                fechaEsperada.setDate(fechaEsperada.getDate() - 1);
            }

            for (let i = 0; i < fechas.length; i++) {
                const fechaActual = new Date(fechas[i]);
                fechaActual.setHours(0, 0, 0, 0);

                if (fechaActual.getTime() === fechaEsperada.getTime()) {
                    rachaActual++;
                    rachaTemp++;
                    // Siguiente día esperado es un día antes
                    fechaEsperada.setDate(fechaEsperada.getDate() - 1);
                } else {
                    // Se rompió la racha
                    break;
                }
            }
        }

        // Calcular racha máxima histórica
        rachaTemp = 1;
        for (let i = 0; i < fechas.length - 1; i++) {
            const fecha1 = new Date(fechas[i]);
            const fecha2 = new Date(fechas[i + 1]);
            fecha1.setHours(0, 0, 0, 0);
            fecha2.setHours(0, 0, 0, 0);

            const diff = Math.floor((fecha1 - fecha2) / (1000 * 60 * 60 * 24));

            if (diff === 1) {
                // Días consecutivos
                rachaTemp++;
                rachaMaxima = Math.max(rachaMaxima, rachaTemp);
            } else {
                // Se rompe la racha
                rachaTemp = 1;
            }
        }
        rachaMaxima = Math.max(rachaMaxima, rachaTemp, rachaActual);

        res.json({
            racha_actual: rachaActual,
            ultima_sesion: results[0].fecha,
            racha_maxima: rachaMaxima
        });
    });
};

module.exports = {
    registrarSesion,
    getRachaActual
};
