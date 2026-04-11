-- ============================================================================
-- Migration: stores 테이블에 매장 연락처 및 SMS 알림 수신 여부 컬럼 추가
-- Date: 2026-04-11
-- Description:
--   회원가입 플로우 간소화(PASS 인증 제거)에 따라 연락처 체계 개편.
--   - phone_number (기존 컬럼) : 사장님 개인 연락처로 의미 재정립
--   - store_phone_number (신규) : 매장 대표 연락처 (고객 노출용)
--   - wants_sms_notification (신규) : 사장님 휴대폰 SMS 알림 수신 동의 여부
-- ============================================================================

-- store_phone_number 컬럼 추가
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stores'
  AND COLUMN_NAME = 'store_phone_number');

SET @sql_stmt = IF(@col_exists = 0,
  'ALTER TABLE stores ADD COLUMN store_phone_number VARCHAR(20) NULL COMMENT ''매장 대표 연락처 (고객 노출용)'' AFTER phone_number',
  'SELECT ''store_phone_number 컬럼이 이미 존재합니다'' AS message');

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- wants_sms_notification 컬럼 추가
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stores'
  AND COLUMN_NAME = 'wants_sms_notification');

SET @sql_stmt = IF(@col_exists = 0,
  'ALTER TABLE stores ADD COLUMN wants_sms_notification BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''사장님 휴대폰 SMS 알림 수신 동의 여부'' AFTER store_phone_number',
  'SELECT ''wants_sms_notification 컬럼이 이미 존재합니다'' AS message');

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ store_phone_number, wants_sms_notification 컬럼 추가 완료!' AS message;
