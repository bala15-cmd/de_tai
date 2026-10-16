const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 1: Trang chủ kiểm tra server
app.get('/', (req, res) => {
    res.send('🚀 Server Quan Ly San Bong Dang Chay!');
});

// API 2: Lấy danh sách tất cả các sân bóng
app.get('/api/fields', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM fields');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API 3: Đặt sân trực tuyến (Kèm kiểm tra trùng lịch)
app.post('/api/bookings', async (req, res) => {
    const { user_id, field_id, booking_date, start_time, end_time, total_price } = req.body;

    // Ràng buộc dữ liệu đầu vào
    if (!field_id || !booking_date || !start_time || !end_time) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vui long cung cap day du thong tin: field_id, booking_date, start_time, end_time' 
        });
    }

    try {
        // Thuật toán kiểm tra trùng lịch trên MySQL
        const checkConflictQuery = `
            SELECT * FROM bookings 
            WHERE field_id = ? 
              AND booking_date = ? 
              AND status IN ('pending', 'confirmed')
              AND start_time < ? 
              AND end_time > ?
        `;

        const [conflicts] = await db.query(checkConflictQuery, [
            field_id, 
            booking_date, 
            end_time, 
            start_time
        ]);

        // Nếu phát hiện trùng lịch
        if (conflicts.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Khung gio nay da co nguoi dat. Vui long chon khung gio hoac san khac!'
            });
        }

        // Nếu không trùng -> Lưu thông tin đặt sân mới
        const insertQuery = `
            INSERT INTO bookings (user_id, field_id, booking_date, start_time, end_time, total_price, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `;

        const [result] = await db.query(insertQuery, [
            user_id || null, 
            field_id, 
            booking_date, 
            start_time, 
            end_time, 
            total_price || 0
        ]);

        res.status(201).json({
            success: true,
            message: 'Dat san thanh cong!',
            booking_id: result.insertId
        });

    } catch (error) {
        console.error('Loi dat san:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API 4: Xem danh sách đơn đặt sân (Dành cho Quản lý / Admin)
app.get('/api/bookings', async (req, res) => {
    try {
        const query = `
            SELECT b.*, f.name AS field_name 
            FROM bookings b
            LEFT JOIN fields f ON b.field_id = f.id
            ORDER BY b.booking_date DESC, b.start_time ASC
        `;
        const [rows] = await db.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
});