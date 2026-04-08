-- FAQ 테이블
CREATE TABLE IF NOT EXISTS faqs (
  id VARCHAR(255) PRIMARY KEY COMMENT 'faq id',
  category VARCHAR(100) NOT NULL COMMENT 'faq category',
  question TEXT NOT NULL COMMENT 'question text',
  answer TEXT NOT NULL COMMENT 'answer text',
  display_order INT NOT NULL DEFAULT 0 COMMENT 'display order',
  is_active TINYINT NOT NULL DEFAULT 1 COMMENT 'active flag',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_category (category),
  INDEX idx_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='FAQ entries';

-- 고객 문의 티켓 테이블
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(255) PRIMARY KEY COMMENT 'ticket id',
  customer_id VARCHAR(255) NOT NULL COMMENT 'customer id',
  title VARCHAR(255) NOT NULL COMMENT 'ticket title',
  status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open' COMMENT 'ticket status',
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium' COMMENT 'priority',
  category VARCHAR(100) DEFAULT '일반' COMMENT 'ticket category',
  last_message_at DATETIME COMMENT 'last message time',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='support tickets';

-- 문의 메시지 테이블
CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(255) PRIMARY KEY COMMENT 'message id',
  ticket_id VARCHAR(255) NOT NULL COMMENT 'ticket id',
  message TEXT NOT NULL COMMENT 'message content',
  is_from_user TINYINT NOT NULL DEFAULT 1 COMMENT '1=customer, 0=staff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_ticket (ticket_id),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='support messages';

-- 기본 FAQ 데이터 삽입
INSERT IGNORE INTO faqs (id, category, question, answer, display_order) VALUES
('faq_001', '이용 방법', '짐을 맡기려면 어떻게 해야 하나요?', '앱에서 원하는 보관소를 검색하고, 예약 버튼을 눌러 짐 크기와 시간을 선택한 후 결제하면 됩니다. 보관소에 도착해서 QR 코드를 보여주면 짐을 맡길 수 있습니다.', 1),
('faq_002', '이용 방법', '짐을 찾으러 갈 때 뭐가 필요한가요?', '앱의 예약 상세 화면에서 QR 코드를 보관소 직원에게 보여주시면 됩니다. 별도의 신분증은 필요하지 않습니다.', 2),
('faq_003', '결제/환불', '예약을 취소하면 환불되나요?', '보관 시작 1시간 전까지 취소하면 전액 환불됩니다. 이후 취소 시 취소 수수료가 부과될 수 있습니다.', 3),
('faq_004', '결제/환불', '어떤 결제 수단을 사용할 수 있나요?', '카카오페이, 네이버페이, 토스페이, 신용/체크카드로 결제할 수 있습니다.', 4),
('faq_005', '보관 안내', '맡길 수 없는 짐이 있나요?', '위험물, 불법 물품, 부패하기 쉬운 음식물(냉장 보관 제외), 귀중품(현금, 여권 등)은 보관할 수 없습니다.', 5);
