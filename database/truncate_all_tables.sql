-- 모든 테이블 데이터 초기화 (외래 키 제약 조건 비활성화)

SET FOREIGN_KEY_CHECKS = 0;

-- 테이블 데이터 삭제 (역순)
TRUNCATE TABLE email_verifications;
TRUNCATE TABLE refresh_tokens;
TRUNCATE TABLE store_settings;
TRUNCATE TABLE store_status;
TRUNCATE TABLE stores;

SET FOREIGN_KEY_CHECKS = 1;

-- 초기화 완료 확인
SELECT '데이터 초기화 완료!' as result;
