const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// API kiểm tra server
app.get('/', (req, res) => {
    res.send('Server Quan Ly San Bong Dang Chay!');
});

// API lấy danh sách sân bóng từ MySQL
app.get('/api/fields', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM fields');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
});