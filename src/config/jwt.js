require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_lsm';

module.exports = JWT_SECRET;
