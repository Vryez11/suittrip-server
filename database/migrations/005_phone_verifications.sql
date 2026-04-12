-- 전화번호 인증 코드 테이블
CREATE TABLE IF NOT EXISTS phone_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'verification id',
  customer_id VARCHAR(255) NOT NULL COMMENT 'customer id',
  phone_number VARCHAR(20) NOT NULL COMMENT 'phone number to verify',
  code VARCHAR(6) NOT NULL COMMENT '6-digit verification code',
  verified TINYINT NOT NULL DEFAULT 0 COMMENT 'is verified',
  attempts INT NOT NULL DEFAULT 0 COMMENT 'verification attempts',
  expires_at DATETIME NOT NULL COMMENT 'code expiry time',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_customer (customer_id),
  INDEX idx_phone (phone_number),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='phone number verification codes';
