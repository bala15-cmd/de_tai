
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const db = require('./db');

// Đọc cấu hình từ data.env
const envPath = path.join(__dirname, 'data.env');

dotenv.config({ path: envPath });

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    name: 'football.sid',
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 8
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ======================================
// 1. CÁC HÀM DÙNG CHUNG
// ======================================

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            message: 'Vui lòng đăng nhập trước.'
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            message: 'Vui lòng đăng nhập.'
        });
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Bạn không có quyền Admin.'
        });
    }

    next();
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role
    };
}

function validId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

function validTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

function timeMinutes(value) {
    const parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
}

function validImageUrl(value) {
    if (!value) return true;

    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

async function createNotification(userId, title, message, bookingId = null) {
    await db.execute(
        `INSERT INTO notifications
            (user_id, booking_id, title, message)
         VALUES (?, ?, ?, ?)`,
        [userId, bookingId, title, message]
    );
}

// ======================================
// 2. KIỂM TRA WEBSITE VÀ TÀI KHOẢN
// ======================================

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            status: 'ok',
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected'
        });
    }
});

app.get('/api/me', (req, res) => {
    res.json({
        user: req.session.user || null
    });
});

// ======================================
// 3. ĐĂNG KÝ
// ======================================

app.post('/api/register', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '')
            .trim()
            .toLowerCase();
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();

        if (name.length < 2 || name.length > 120) {
            return res.status(400).json({
                message: 'Họ tên phải có từ 2 đến 120 ký tự.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                message: 'Email không hợp lệ.'
            });
        }

        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({
                message: 'Mật khẩu phải có từ 8 đến 128 ký tự.'
            });
        }

        const [existing] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length) {
            return res.status(409).json({
                message: 'Email này đã được đăng ký.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.execute(
            `INSERT INTO users
                (name, email, password_hash, phone, role)
             VALUES (?, ?, ?, ?, 'user')`,
            [name, email, passwordHash, phone || null]
        );

        await regenerateSession(req);

        req.session.user = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
};

res.json({
  message: "Đăng nhập thành công",
  user: req.session.user
});
    } catch (error) {
        console.error('Register error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Email này đã được sử dụng.'
            });
        }

        res.status(500).json({
            message: 'Không thể đăng ký tài khoản.'
        });
    }
});

// ======================================
// 4. ĐĂNG NHẬP
// ======================================

app.post('/api/login', async (req, res) => {
    try {
        const email = String(req.body.email || '')
            .trim()
            .toLowerCase();
        const password = String(req.body.password || '');

        const [rows] = await db.execute(
            `SELECT id, name, email, password_hash,
                    phone, role, is_active
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        if (!rows.length) {
            return res.status(401).json({
                message: 'Email hoặc mật khẩu không đúng.'
            });
        }

        const user = rows[0];

        const passwordCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                message: 'Email hoặc mật khẩu không đúng.'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                message: 'Tài khoản đã bị khóa.'
            });
        }

        await regenerateSession(req);

        req.session.user = publicUser(user);
        await saveSession(req);

        res.json({
            message: 'Đăng nhập thành công.',
            user: req.session.user
        });
    } catch (error) {
        console.error('Login error:', error);

        res.status(500).json({
            message: 'Không thể đăng nhập.'
        });
    }
});

// ======================================
// 5. ĐĂNG XUẤT
// ======================================

app.post('/api/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: 'Không thể đăng xuất.'
            });
        }

        res.clearCookie('football.sid');

        res.json({
            message: 'Đã đăng xuất.'
        });
    });
});

// ======================================
// 6. DANH SÁCH VÀ TÌM KIẾM SÂN
// ======================================

app.get('/api/fields', async (req, res) => {
    try {
        const keyword = String(req.query.q || '').trim();
        const location = String(req.query.location || '').trim();
        const fieldType = String(req.query.field_type || '').trim();

        let sql = `
            SELECT
                f.id,
                f.name,
                f.field_type,
                f.price_per_hour,
                f.location,
                f.image_url,
                f.description,
                COALESCE(AVG(r.rating), 0) AS average_rating,
                COUNT(r.id) AS review_count
            FROM fields f
            LEFT JOIN reviews r ON r.field_id = f.id
            WHERE f.is_active = 1
        `;

        const params = [];

        if (keyword) {
            sql += ` AND (
                f.name LIKE ?
                OR f.location LIKE ?
                OR f.field_type LIKE ?
            )`;

            const search = `%${keyword}%`;
            params.push(search, search, search);
        }

        if (location) {
            sql += ' AND f.location LIKE ?';
            params.push(`%${location}%`);
        }

        if (fieldType) {
            sql += ' AND f.field_type = ?';
            params.push(fieldType);
        }

        sql += `
            GROUP BY f.id
            ORDER BY f.id DESC
        `;

        const [fields] = await db.execute(sql, params);

        res.json(fields);
    } catch (error) {
        console.error('Get fields error:', error);

        res.status(500).json({
            message: 'Không tải được danh sách sân.'
        });
    }
});

// Chi tiết một sân
app.get('/api/fields/:id', async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
        return res.status(400).json({
            message: 'ID sân không hợp lệ.'
        });
    }

    try {
        const [rows] = await db.execute(
            `SELECT
                f.id,
                f.name,
                f.field_type,
                f.price_per_hour,
                f.location,
                f.image_url,
                f.description,
                COALESCE(AVG(r.rating), 0) AS average_rating,
                COUNT(r.id) AS review_count
             FROM fields f
             LEFT JOIN reviews r ON r.field_id = f.id
             WHERE f.id = ? AND f.is_active = 1
             GROUP BY f.id`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                message: 'Không tìm thấy sân.'
            });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không thể tải chi tiết sân.'
        });
    }
});

// ======================================
// 7. ĐẶT SÂN
// ======================================

app.post('/api/bookings', requireLogin, async (req, res) => {
    const fieldId = validId(req.body.field_id);
    const date = String(req.body.booking_date || '');
    const start = String(req.body.start_time || '');
    const end = String(req.body.end_time || '');
    const note = String(req.body.note || '').trim();

    if (!fieldId || !validDate(date)) {
        return res.status(400).json({
            message: 'Sân hoặc ngày đặt không hợp lệ.'
        });
    }

    if (!validTime(start) || !validTime(end)) {
        return res.status(400).json({
            message: 'Giờ bắt đầu hoặc kết thúc không hợp lệ.'
        });
    }

    const startMinutes = timeMinutes(start);
    const endMinutes = timeMinutes(end);

    if (startMinutes >= endMinutes) {
        return res.status(400).json({
            message: 'Giờ kết thúc phải sau giờ bắt đầu.'
        });
    }

    if (startMinutes < 6 * 60 || endMinutes > 23 * 60) {
        return res.status(400).json({
            message: 'Sân chỉ nhận lịch từ 06:00 đến 23:00.'
        });
    }

    if (date < new Date().toLocaleDateString('en-CA')) {
        return res.status(400).json({
            message: 'Không thể đặt sân vào ngày đã qua.'
        });
    }

    if (note.length > 500) {
        return res.status(400).json({
            message: 'Ghi chú tối đa 500 ký tự.'
        });
    }

    try {
        const [fields] = await db.execute(
            `SELECT id, name, price_per_hour
             FROM fields
             WHERE id = ? AND is_active = 1`,
            [fieldId]
        );

        if (!fields.length) {
            return res.status(404).json({
                message: 'Sân không tồn tại hoặc đã ngừng hoạt động.'
            });
        }

        const [conflicts] = await db.execute(
            `SELECT id
             FROM bookings
             WHERE field_id = ?
               AND booking_date = ?
               AND status IN ('pending', 'confirmed')
               AND start_time < ?
               AND end_time > ?
             LIMIT 1`,
            [fieldId, date, `${end}:00`, `${start}:00`]
        );

        if (conflicts.length) {
            return res.status(409).json({
                message: 'Khung giờ này đã có người đặt.'
            });
        }

        // Tính tiền dựa trên số phút thực tế
        const hours = (endMinutes - startMinutes) / 60;
        const totalPrice = Math.round(
            hours * Number(fields[0].price_per_hour)
        );

        const [result] = await db.execute(
            `INSERT INTO bookings
                (user_id, field_id, booking_date,
                 start_time, end_time, total_price, status, note)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [
                req.session.user.id,
                fieldId,
                date,
                `${start}:00`,
                `${end}:00`,
                totalPrice,
                note || null
            ]
        );

        await createNotification(
            req.session.user.id,
            'Đặt sân thành công',
            `Yêu cầu đặt ${fields[0].name} ngày ${date} đã được gửi và đang chờ xác nhận.`,
            result.insertId
        );

        res.status(201).json({
            message: 'Đặt sân thành công, đang chờ xác nhận.',
            booking_id: result.insertId,
            total_price: totalPrice
        });
    } catch (error) {
        console.error('Booking error:', error);

        res.status(500).json({
            message: 'Không thể đặt sân lúc này.'
        });
    }
});

// ======================================
// 8. LỊCH ĐẶT CỦA NGƯỜI DÙNG
// ======================================

app.get('/api/bookings/mine', requireLogin, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                b.id,
                b.field_id,
                f.name AS field_name,
                f.location,
                f.image_url,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.total_price,
                b.status,
                b.note,
                b.created_at
             FROM bookings b
             JOIN fields f ON f.id = b.field_id
             WHERE b.user_id = ?
             ORDER BY b.booking_date DESC, b.start_time DESC`,
            [req.session.user.id]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không tải được lịch đặt sân.'
        });
    }
});

// Người dùng tự hủy đơn đang chờ xác nhận
app.patch(
    '/api/bookings/:id/cancel',
    requireLogin,
    async (req, res) => {
        const id = validId(req.params.id);

        if (!id) {
            return res.status(400).json({
                message: 'ID đơn đặt không hợp lệ.'
            });
        }

        try {
            const [result] = await db.execute(
                `UPDATE bookings
                 SET status = 'cancelled'
                 WHERE id = ?
                   AND user_id = ?
                   AND status = 'pending'`,
                [id, req.session.user.id]
            );

            if (!result.affectedRows) {
                return res.status(400).json({
                    message:
                        'Không tìm thấy đơn hoặc đơn không còn ở trạng thái chờ.'
                });
            }

            await createNotification(
                req.session.user.id,
                'Đã hủy đơn đặt sân',
                `Đơn đặt sân #${id} đã được hủy.`,
                id
            );

            res.json({
                message: 'Đã hủy đơn đặt sân.'
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không thể hủy đơn đặt sân.'
            });
        }
    }
);

// ======================================
// 9. THÔNG BÁO CỦA NGƯỜI DÙNG
// ======================================

app.get(
    '/api/notifications',
    requireLogin,
    async (req, res) => {
        try {
            const [rows] = await db.execute(
                `SELECT id, booking_id, title, message,
                        is_read, created_at
                 FROM notifications
                 WHERE user_id = ?
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [req.session.user.id]
            );

            res.json(rows);
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không tải được thông báo.'
            });
        }
    }
);

app.patch(
    '/api/notifications/:id/read',
    requireLogin,
    async (req, res) => {
        const id = validId(req.params.id);

        if (!id) {
            return res.status(400).json({
                message: 'ID thông báo không hợp lệ.'
            });
        }

        try {
            await db.execute(
                `UPDATE notifications
                 SET is_read = 1
                 WHERE id = ? AND user_id = ?`,
                [id, req.session.user.id]
            );

            res.json({
                message: 'Đã đánh dấu thông báo đã đọc.'
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không thể cập nhật thông báo.'
            });
        }
    }
);

// ======================================
// 10. THÔNG TIN TÀI KHOẢN
// ======================================

app.patch('/api/profile', requireLogin, async (req, res) => {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();

    if (name.length < 2 || name.length > 120) {
        return res.status(400).json({
            message: 'Tên phải có từ 2 đến 120 ký tự.'
        });
    }

    if (phone.length > 20) {
        return res.status(400).json({
            message: 'Số điện thoại tối đa 20 ký tự.'
        });
    }

    try {
        await db.execute(
            'UPDATE users SET name = ?, phone = ? WHERE id = ?',
            [name, phone || null, req.session.user.id]
        );

        req.session.user.name = name;
        req.session.user.phone = phone;

        await saveSession(req);

        res.json({
            message: 'Đã cập nhật tài khoản.',
            user: req.session.user
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không thể cập nhật tài khoản.'
        });
    }
});

// ======================================
// 11. ADMIN - THỐNG KÊ TỔNG QUAN
// ======================================

app.get(
    '/api/admin/summary',
    requireAdmin,
    async (req, res) => {
        try {
            const [[users]] = await db.query(
                `SELECT COUNT(*) AS total
                 FROM users
                 WHERE role = 'user'`
            );

            const [[fields]] = await db.query(
                `SELECT COUNT(*) AS total
                 FROM fields
                 WHERE is_active = 1`
            );

            const [[todayBookings]] = await db.query(
                `SELECT COUNT(*) AS total
                 FROM bookings
                 WHERE booking_date = CURDATE()
                   AND status <> 'cancelled'`
            );

            const [[revenueToday]] = await db.query(
                `SELECT COALESCE(SUM(total_price), 0) AS total
                 FROM bookings
                 WHERE booking_date = CURDATE()
                   AND status = 'confirmed'`
            );

            const [[allBookings]] = await db.query(
                'SELECT COUNT(*) AS total FROM bookings'
            );

            const [[pending]] = await db.query(
                `SELECT COUNT(*) AS total
                 FROM bookings
                 WHERE status = 'pending'`
            );

            const [[totalRevenue]] = await db.query(
                `SELECT COALESCE(SUM(total_price), 0) AS total
                 FROM bookings
                 WHERE status = 'confirmed'`
            );

            res.json({
                users: users.total,
                fields: fields.total,
                bookings_today: todayBookings.total,
                bookings: allBookings.total,
                pending_bookings: pending.total,
                revenue_today: Number(revenueToday.total),
                total_revenue: Number(totalRevenue.total)
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không tải được thống kê.'
            });
        }
    }
);

// ======================================
// 12. ADMIN - QUẢN LÝ SÂN
// ======================================

app.get('/api/admin/fields', requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                id, name, field_type, price_per_hour,
                location, image_url, description, is_active
             FROM fields
             ORDER BY id DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không tải được danh sách sân.'
        });
    }
});

app.post('/api/admin/fields', requireAdmin, async (req, res) => {
    const name = String(req.body.name || '').trim();
    const type = String(req.body.field_type || '5 người');
    const price = Number(req.body.price_per_hour);
    const location = String(req.body.location || '').trim();
    const image = String(req.body.image_url || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name || name.length > 120) {
        return res.status(400).json({
            message: 'Tên sân không hợp lệ.'
        });
    }

    if (!['5 người', '7 người', '11 người'].includes(type)) {
        return res.status(400).json({
            message: 'Loại sân không hợp lệ.'
        });
    }

    if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
            message: 'Giá sân phải lớn hơn 0.'
        });
    }

    if (!validImageUrl(image)) {
        return res.status(400).json({
            message: 'URL ảnh không hợp lệ.'
        });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO fields
                (name, field_type, price_per_hour, location,
                 image_url, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name,
                type,
                price,
                location,
                image || null,
                description || null
            ]
        );

        res.status(201).json({
            message: 'Đã thêm sân bóng.',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không thể thêm sân.'
        });
    }
});

app.patch(
    '/api/admin/fields/:id',
    requireAdmin,
    async (req, res) => {
        const id = validId(req.params.id);

        if (!id) {
            return res.status(400).json({
                message: 'ID sân không hợp lệ.'
            });
        }

        const name = String(req.body.name || '').trim();
        const type = String(req.body.field_type || '');
        const price = Number(req.body.price_per_hour);
        const location = String(req.body.location || '').trim();
        const image = String(req.body.image_url || '').trim();
        const description = String(req.body.description || '').trim();

        if (
            !name ||
            name.length > 120 ||
            !['5 người', '7 người', '11 người'].includes(type) ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !validImageUrl(image)
        ) {
            return res.status(400).json({
                message: 'Thông tin sân không hợp lệ.'
            });
        }

        try {
            const [result] = await db.execute(
                `UPDATE fields
                 SET name = ?,
                     field_type = ?,
                     price_per_hour = ?,
                     location = ?,
                     image_url = ?,
                     description = ?
                 WHERE id = ?`,
                [
                    name,
                    type,
                    price,
                    location,
                    image || null,
                    description || null,
                    id
                ]
            );

            if (!result.affectedRows) {
                const [rows] = await db.execute(
                    'SELECT id FROM fields WHERE id = ?',
                    [id]
                );

                if (!rows.length) {
                    return res.status(404).json({
                        message: 'Không tìm thấy sân.'
                    });
                }
            }

            res.json({
                message: 'Đã cập nhật thông tin sân.'
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không thể cập nhật sân.'
            });
        }
    }
);

// Ẩn sân thay vì xóa để giữ lịch sử đặt
app.patch(
    '/api/admin/fields/:id/status',
    requireAdmin,
    async (req, res) => {
        const id = validId(req.params.id);
        const active = req.body.is_active;

        if (!id || ![0, 1, true, false].includes(active)) {
            return res.status(400).json({
                message: 'Dữ liệu trạng thái không hợp lệ.'
            });
        }

        try {
            const [result] = await db.execute(
                'UPDATE fields SET is_active = ? WHERE id = ?',
                [active ? 1 : 0, id]
            );

            if (!result.affectedRows) {
                return res.status(404).json({
                    message: 'Không tìm thấy sân.'
                });
            }

            res.json({
                message: active
                    ? 'Đã mở lại sân.'
                    : 'Đã ẩn sân.'
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không thể cập nhật trạng thái sân.'
            });
        }
    }
);

// ======================================
// 13. ADMIN - QUẢN LÝ ĐƠN ĐẶT
// ======================================

app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
    try {
        const status = String(req.query.status || '');
        const params = [];

        let sql = `
            SELECT
                b.id,
                u.name AS user_name,
                u.email,
                u.phone,
                f.name AS field_name,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.total_price,
                b.status,
                b.note,
                b.created_at
            FROM bookings b
            JOIN users u ON u.id = b.user_id
            JOIN fields f ON f.id = b.field_id
        `;

        if (['pending', 'confirmed', 'cancelled'].includes(status)) {
            sql += ' WHERE b.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY b.booking_date DESC, b.start_time DESC';

        const [rows] = await db.execute(sql, params);

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không tải được danh sách đơn.'
        });
    }
});

app.patch(
    '/api/admin/bookings/:id',
    requireAdmin,
    async (req, res) => {
        const id = validId(req.params.id);
        const status = String(req.body.status || '');

        if (!id) {
            return res.status(400).json({
                message: 'ID đơn đặt không hợp lệ.'
            });
        }

        if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                message: 'Trạng thái đơn không hợp lệ.'
            });
        }

        try {
            const [rows] = await db.execute(
                `SELECT id, user_id, field_id, booking_date,
                        start_time, end_time, status
                 FROM bookings
                 WHERE id = ?`,
                [id]
            );

            if (!rows.length) {
                return res.status(404).json({
                    message: 'Không tìm thấy đơn đặt sân.'
                });
            }

            const booking = rows[0];

            // Khi xác nhận, kiểm tra không có đơn khác trùng giờ
            if (status === 'confirmed') {
                const [conflicts] = await db.execute(
                    `SELECT id
                     FROM bookings
                     WHERE field_id = ?
                       AND booking_date = ?
                       AND id <> ?
                       AND status = 'confirmed'
                       AND start_time < ?
                       AND end_time > ?
                     LIMIT 1`,
                    [
                        booking.field_id,
                        booking.booking_date,
                        id,
                        booking.end_time,
                        booking.start_time
                    ]
                );

                if (conflicts.length) {
                    return res.status(409).json({
                        message:
                            'Không thể xác nhận vì sân bị trùng với đơn đã xác nhận.'
                    });
                }
            }

            await db.execute(
                'UPDATE bookings SET status = ? WHERE id = ?',
                [status, id]
            );

            const messages = {
                pending: 'Đơn đặt sân đang chờ xác nhận.',
                confirmed: 'Đơn đặt sân của bạn đã được xác nhận.',
                cancelled: 'Đơn đặt sân của bạn đã bị hủy.'
            };

            await createNotification(
                booking.user_id,
                'Cập nhật đơn đặt sân',
                messages[status],
                id
            );

            res.json({
                message: 'Đã cập nhật trạng thái đơn.'
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không thể cập nhật đơn đặt sân.'
            });
        }
    }
);

// ======================================
// 14. ADMIN - QUẢN LÝ NGƯỜI DÙNG
// ======================================

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                id, name, email, phone, role,
                is_active, created_at
             FROM users
             ORDER BY created_at DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Không tải được danh sách người dùng.'
        });
    }
});

app.patch(
    '/api/admin/users/:id/status',
    requireAdmin,
    async (req, res) => {
        const id = validId(req.params.id);
        const active = req.body.is_active;

        if (!id || ![0, 1, true, false].includes(active)) {
            return res.status(400).json({
                message: 'Dữ liệu không hợp lệ.'
            });
        }

        if (id === req.session.user.id && !active) {
            return res.status(400).json({
                message: 'Bạn không thể tự khóa tài khoản của mình.'
            });
        }

        try {
            const [result] = await db.execute(
                `UPDATE users
                 SET is_active = ?
                 WHERE id = ? AND role <> 'admin'`,
                [active ? 1 : 0, id]
            );

            if (!result.affectedRows) {
                return res.status(404).json({
                    message:
                        'Không tìm thấy người dùng hoặc không thể thay đổi tài khoản Admin.'
                });
            }

            res.json({
                message: active
                    ? 'Đã mở khóa người dùng.'
                    : 'Đã khóa người dùng.'
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không thể cập nhật người dùng.'
            });
        }
    }
);

// ======================================
// 15. ADMIN - BÁO CÁO DOANH THU 7 NGÀY
// ======================================

app.get(
    '/api/admin/revenue',
    requireAdmin,
    async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT
                    DATE(booking_date) AS date,
                    COUNT(*) AS booking_count,
                    COALESCE(SUM(total_price), 0) AS revenue
                 FROM bookings
                 WHERE status = 'confirmed'
                   AND booking_date >= CURDATE() - INTERVAL 6 DAY
                   AND booking_date <= CURDATE()
                 GROUP BY DATE(booking_date)
                 ORDER BY date ASC`
            );

            res.json(rows);
        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: 'Không tải được báo cáo doanh thu.'
            });
        }
    }
);

// ======================================
// 16. ĐIỀU HƯỚNG CÁC TRANG HTML
// ======================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ======================================
// 17. KHỞI ĐỘNG SERVER
// ======================================

async function startServer() {
    try {
        await db.query('SELECT 1');

        app.listen(PORT, () => {
            console.log('===================================');
            console.log(' FOOTBALL HUB - QUẢN LÝ SÂN BÓNG');
            console.log(` Website: http://localhost:${PORT}`);
            console.log(' Database: MySQL kết nối thành công');
            console.log('===================================');
        });
    } catch (error) {
        console.error('Không kết nối được MySQL.');
        console.error('Hãy kiểm tra XAMPP, data.env và database.sql.');
        console.error(error.message);
        process.exit(1);
    }
}

startServer();
// ===============================
// ROUTE GIAO DIỆN WEBSITE
// ===============================

// Trang chủ: luôn hiển thị giao diện người dùng
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Trang đăng nhập
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Trang quản trị Admin
app.get("/admin", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "admin") {
    return res.redirect("/");
  }

  return res.sendFile(
    path.join(__dirname, "public", "admin.html")
  );
});