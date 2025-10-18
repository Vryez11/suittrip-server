-- email_verifications 테이블 재생성
-- 기존 테이블 삭제
DROP TABLE IF EXISTS email_verifications;

-- 테이블 다시 생성
CREATE TABLE email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '인증 ID',
  email VARCHAR(255) NOT NULL COMMENT '이메일',
  code VARCHAR(10) NOT NULL COMMENT '인증 코드',
  is_verified BOOLEAN DEFAULT FALSE COMMENT '인증 완료 여부',
  expires_at TIMESTAMP NOT NULL COMMENT '만료 시간',
  attempt_count INT DEFAULT 0 COMMENT '시도 횟수',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='이메일 인증';
