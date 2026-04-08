-- 고객 결제수단 관리 테이블
CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id VARCHAR(255) PRIMARY KEY COMMENT 'payment method id',
  customer_id VARCHAR(255) NOT NULL COMMENT 'customer id',
  type ENUM('card', 'bank') NOT NULL COMMENT 'payment type',
  name VARCHAR(100) NOT NULL COMMENT 'card/bank name',
  last_four_digits VARCHAR(4) COMMENT 'last 4 digits',
  expiry_date VARCHAR(10) COMMENT 'expiry date (MM/YY)',
  is_default TINYINT NOT NULL DEFAULT 0 COMMENT 'default payment method',
  billing_key VARCHAR(500) COMMENT 'toss billing key for auto-payment',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_customer (customer_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='customer payment methods';
