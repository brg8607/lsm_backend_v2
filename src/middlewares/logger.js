// Middleware de logging para todas las peticiones
const logger = (req, res, next) => {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${req.url}`);
    next();
};

module.exports = logger;
