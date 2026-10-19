
CREATE DATABASE IF NOT EXISTS football_field
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE football_field;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fields (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  price_per_hour DECIMAL(12, 2) NOT NULL DEFAULT 0,
  location VARCHAR(255) NOT NULL,
  image_url VARCHAR(1000) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  field_id INT UNSIGNED NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM(
    'pending',
    'confirmed',
    'cancelled',
    'rejected',
    'completed'
  ) NOT NULL DEFAULT 'pending',
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_bookings_field
    FOREIGN KEY (field_id) REFERENCES fields(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_booking_date (booking_date),
  INDEX idx_booking_field_time (field_id, booking_date, start_time, end_time),
  INDEX idx_booking_user (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  booking_id INT UNSIGNED DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_notifications_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  INDEX idx_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  field_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),

  CONSTRAINT fk_reviews_field
    FOREIGN KEY (field_id) REFERENCES fields(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_reviews_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Dữ liệu sân mẫu để kiểm tra giao diện.
INSERT INTO fields
  (name, field_type, price_per_hour, location, image_url, description)
SELECT
  'Sân bóng Green Star',
  '7 người',
  350000,
  'Khu vực trung tâm',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=900&q=80',
  'Sân cỏ nhân tạo, phù hợp cho các trận bóng cùng bạn bè.'
WHERE NOT EXISTS (
  SELECT 1 FROM fields WHERE name = 'Sân bóng Green Star'
);

INSERT INTO fields
  (name, field_type, price_per_hour, location, image_url, description)
SELECT
  'Sân bóng Victory',
  '5 người',
  250000,
  'Khu vực thể thao',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=900&q=80',
  'Sân bóng nhỏ gọn, phù hợp thi đấu nhóm.'
WHERE NOT EXISTS (
  SELECT 1 FROM fields WHERE name = 'Sân bóng Victory'
);

INSERT INTO fields
  (name, field_type, price_per_hour, location, image_url, description)
SELECT
  'Sân bóng Champion',
  '11 người',
  600000,
  'Khu liên hợp thể thao',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=900&q=80',
  'Không gian rộng cho các trận đấu đông người.'
WHERE NOT EXISTS (
  SELECT 1 FROM fields WHERE name = 'Sân bóng Champion'
);
