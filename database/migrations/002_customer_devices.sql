-- 고객 디바이스/푸시토큰 관리 테이블
CREATE TABLE IF NOT EXISTS customer_devices (
  id VARCHAR(255) PRIMARY KEY COMMENT 'device id',
  customer_id VARCHAR(255) NOT NULL COMMENT 'customer id',
  push_token VARCHAR(500) NOT NULL COMMENT 'expo push token',
  device_type ENUM('ios', 'android') NOT NULL COMMENT 'device platform',
  device_name VARCHAR(255) COMMENT 'device model name',
  is_active TINYINT NOT NULL DEFAULT 1 COMMENT 'active flag',
  last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'last login time',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'created at',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated at',

  INDEX idx_customer (customer_id),
  INDEX idx_push_token (push_token(255)),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='customer devices for push notifications';
