-- ============================================================================
-- Migration: categories 컬럼 추가
-- Date: 2025-01-14
-- Description: store_settings 테이블에 메뉴 카테고리 JSON 컬럼 추가
-- ============================================================================

-- Check if column exists and add it if it doesn't
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'store_settings'
  AND COLUMN_NAME = 'categories');

SET @sql_stmt = IF(@col_exists = 0,
  'ALTER TABLE store_settings ADD COLUMN categories JSON COMMENT ''메뉴 카테고리 (JSON 배열)''',
  'SELECT ''categories 컬럼이 이미 존재합니다'' AS message');

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ categories 컬럼 추가 완료!' AS message;
