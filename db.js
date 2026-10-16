const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'quan_ly_san_bong',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: false
});

// Kiểm tra kết nối
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Ket noi Database that bai:', err.message);
    } else {
        console.log('✅ Da ket noi thanh cong toi Database quan_ly_san_bong!');
        connection.release();
    }
});

module.exports = pool.promise();