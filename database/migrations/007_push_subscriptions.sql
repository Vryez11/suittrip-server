-- 웹 푸시 구독 테이블
-- 비회원 예약에 대한 웹 푸시 알림 구독 정보 저장
-- 알림은 2종류만: 예약 완료 + 체크아웃 30분 전

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '구독 ID',
  reservation_id VARCHAR(255) NOT NULL COMMENT '예약 ID',
  endpoint TEXT NOT NULL COMMENT 'Push 서비스 URL',
  p256dh VARCHAR(500) NOT NULL COMMENT '암호화 키',
  auth VARCHAR(255) NOT NULL COMMENT '인증 키',
  locale VARCHAR(5) DEFAULT 'en' COMMENT '알림 언어 (ko/en/ja/zh)',
  sent_reminder_at DATETIME NULL COMMENT '체크아웃 리마인더 발송 시각 (중복 방지)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',

  INDEX idx_reservation (reservation_id),
  INDEX idx_reminder (sent_reminder_at),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='웹 푸시 구독';
