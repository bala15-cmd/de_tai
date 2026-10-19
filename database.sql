CREATE DATABASE IF NOT EXISTS `quan_ly_san_bong` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `quan_ly_san_bong`;

-- 1. Bảng Người dùng (Users)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `fullname` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('user', 'admin') DEFAULT 'user',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Thêm tài khoản Admin mẫu (Mật khẩu: admin123) và User mẫu (Mật khẩu: user123)
INSERT INTO `users` (`fullname`, `email`, `password`, `role`) VALUES
('Quản Trị Viên', 'admin@gmail.com', 'admin123', 'admin'),
('Nguyễn Văn A', 'user@gmail.com', 'user123', 'user');

-- 2. Bảng Danh sách Sân bóng (Fields)
DROP TABLE IF EXISTS `fields`;
CREATE TABLE `fields` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `price_per_hour` DECIMAL(10,2) NOT NULL,
    `status` ENUM('active', 'maintenance') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `fields` (`name`, `type`, `price_per_hour`) VALUES
('Sân Bóng A1 (Sân 5)', 'Sân 5', 200000.00),
('Sân Bóng A2 (Sân 5)', 'Sân 5', 200000.00),
('Sân Bóng B1 (Sân 7)', 'Sân 7', 350000.00);

-- 3. Bảng Đặt Sân (Bookings)
DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `field_id` INT NOT NULL,
    `booking_date` DATE NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `total_price` DECIMAL(10,2) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    `payment_status` ENUM('unpaid', 'paid') DEFAULT 'unpaid',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;