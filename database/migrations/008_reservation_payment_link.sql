-- 008: 예약-결제 연결
-- "결제 → 예약" 플로우: 결제 완료 후 예약 생성 시 결제 레코드와 연결
-- Landing checkout API가 payment_key/order_id와 함께 예약을 생성하면
-- 이 컬럼으로 payments 테이블과 양방향 참조 가능

ALTER TABLE reservations ADD COLUMN payment_id BIGINT UNSIGNED NULL COMMENT '결제 ID (payments.id)' AFTER payment_method;
ALTER TABLE reservations ADD CONSTRAINT fk_reservation_payment
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
