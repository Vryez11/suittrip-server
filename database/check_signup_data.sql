-- 회원가입 후 데이터베이스 확인

-- 1. stores 테이블 확인
SELECT
  id,
  email,
  name,
  phone_number,
  business_number,
  business_name,
  representative_name,
  has_completed_setup,
  created_at
FROM stores
ORDER BY created_at DESC
LIMIT 5;

-- 2. store_status 테이블 확인
SELECT
  store_id,
  is_open,
  total_capacity,
  available_capacity,
  updated_at
FROM store_status
ORDER BY updated_at DESC
LIMIT 5;

-- 3. store_settings 테이블 확인
SELECT
  store_id,
  small_locker_price,
  medium_locker_price,
  large_locker_price,
  operating_start_time,
  operating_end_time,
  updated_at
FROM store_settings
ORDER BY updated_at DESC
LIMIT 5;

-- 4. refresh_tokens 테이블 확인
SELECT
  store_id,
  token,
  expires_at,
  created_at
FROM refresh_tokens
ORDER BY created_at DESC
LIMIT 5;

-- 5. email_verifications 테이블 확인
SELECT
  email,
  code,
  is_verified,
  expires_at,
  created_at
FROM email_verifications
ORDER BY created_at DESC
LIMIT 5;
