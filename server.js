const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 1. API XÁC THỰC (AUTH) ====================

// Đăng ký
app.post('/api/auth/register', async (req, res) => {
    const { fullname, email, password } = req.body;
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email này đã tồn tại!' });
        }

        await db.query(
            'INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, "user")',
            [fullname, email, password]
        );

        res.json({ success: true, message: 'Đăng ký tài khoản thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query(
            'SELECT id, fullname, email, role FROM users WHERE email = ? AND password = ?',
            [email, password]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác!' });
        }

        const user = users[0];
        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: { id: user.id, fullname: user.fullname, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== 2. API KHÁCH HÀNG (USER) ====================

// Lấy danh sách sân
app.get('/api/fields', async (req, res) => {
    try {
        const [fields] = await db.query('SELECT * FROM fields WHERE status = "active"');
        res.json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Tạo đơn đặt sân
app.post('/api/bookings', async (req, res) => {
    const { user_id, field_id, booking_date, start_time, end_time, total_price } = req.body;
    try {
        const query = `
            INSERT INTO bookings (user_id, field_id, booking_date, start_time, end_time, total_price, status, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 'unpaid')
        `;
        const [result] = await db.query(query, [user_id, field_id, booking_date, start_time, end_time, total_price]);
        res.json({ success: true, message: 'Đặt sân thành công! Vui lòng chờ duyệt.', bookingId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== 3. API QUẢN TRỊ (ADMIN) ====================

// Lấy toàn bộ đơn đặt sân kèm thông tin Khách
app.get('/api/admin/bookings', async (req, res) => {
    try {
        const query = `
            SELECT bookings.id, 
                   COALESCE(users.fullname, 'Khách vãng lai') AS customer_name,
                   COALESCE(users.email, 'N/A') AS customer_email,
                   fields.name AS field_name, 
                   bookings.booking_date, 
                   bookings.start_time, 
                   bookings.end_time, 
                   bookings.total_price, 
                   bookings.status, 
                   bookings.payment_status
            FROM bookings
            JOIN fields ON bookings.field_id = fields.id
            LEFT JOIN users ON bookings.user_id = users.id
            ORDER BY bookings.id DESC
        `;
        const [rows] = await db.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cập nhật trạng thái đơn (Duyệt/Hủy)
app.put('/api/admin/bookings/:id', async (req, res) => {
    const bookingId = req.params.id;
    const { status } = req.body;
    try {
        await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId]);
        res.json({ success: true, message: 'Đã cập nhật trạng thái đơn!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// 1. API lấy lịch sử đặt sân của riêng 1 user
app.get('/api/bookings/user/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const query = `
            SELECT bookings.*, fields.name AS field_name 
            FROM bookings
            JOIN fields ON bookings.field_id = fields.id
            WHERE bookings.user_id = ?
            ORDER BY bookings.id DESC
        `;
        const [rows] = await db.query(query, [userId]);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. API Thống kê tổng quan cho Admin (Doanh thu, tổng đơn)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const [totalBookings] = await db.query('SELECT COUNT(*) AS count FROM bookings');
        const [totalRevenue] = await db.query('SELECT SUM(total_price) AS revenue FROM bookings WHERE status = "confirmed"');
        const [pendingBookings] = await db.query('SELECT COUNT(*) AS count FROM bookings WHERE status = "pending"');

        res.json({
            success: true,
            stats: {
                totalBookings: totalBookings[0].count,
                totalRevenue: totalRevenue[0].revenue || 0,
                pendingBookings: pendingBookings[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});