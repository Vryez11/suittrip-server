-- 009_add_store_slug.sql
-- 고객 공유 URL용 slug 컬럼 추가.
-- QR 포스터 및 공유 링크에서 UUID(store_<uuid>) 대신 읽기 쉬운 slug를 노출하여
-- 사용성 + SEO를 개선한다.
--
-- 예) 이전: https://lifeistravel.io/?store=store_9c9417ac-...
--     이후: https://lifeistravel.io/?store=cafe-seoul-gangnam
--
-- slug는 nullable — 기존 매장 및 신규 매장 모두 slug 미지정 시 기존 id로 조회 가능.
-- 프론트엔드는 `slug ?? id` fallback으로 동작하므로 배포 순서에 무관하게 호환된다.

ALTER TABLE stores
  ADD COLUMN slug VARCHAR(80) NULL COMMENT '고객 공유 URL용 slug (예: cafe-seoul-gangnam). 영문 소문자+숫자+하이픈 권장'
  AFTER business_name;

ALTER TABLE stores
  ADD UNIQUE KEY uniq_store_slug (slug);
