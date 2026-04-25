/**
 * 기존 매장(slug NULL) 에 자동 slug 채우기.
 *
 * 사용:
 *   node scripts/backfill-store-slugs.js
 *
 * 동작:
 *   - slug IS NULL 인 모든 매장을 순회
 *   - generateUniqueSlug(business_name, ...) 으로 충돌 없는 slug 생성
 *   - UPDATE stores SET slug = ? WHERE id = ?
 *
 * 안전성:
 *   - DB에 UNIQUE 제약 있으므로 동일 slug 두 번 쓰는 사고 자동 차단
 *   - 한글 매장명은 ASCII 변환 어려워 store-<랜덤6> 형태로 저장됨
 *   - 멱등 — 이미 slug 있는 매장은 건너뜀
 */

import { query, pool } from '../src/config/database.js';
import { generateUniqueSlug } from '../src/utils/slugify.js';

async function main() {
  const stores = await query('SELECT id, business_name FROM stores WHERE slug IS NULL');
  if (!stores.length) {
    console.log('백필 대상 없음 — 모든 매장이 이미 slug 보유');
    await pool.end();
    return;
  }

  console.log(`${stores.length}개 매장에 slug 발급 시작...`);

  for (const s of stores) {
    try {
      const slug = await generateUniqueSlug(s.business_name, async (candidate) => {
        const rows = await query('SELECT 1 FROM stores WHERE slug = ? LIMIT 1', [candidate]);
        return Array.isArray(rows) && rows.length > 0;
      });
      await query('UPDATE stores SET slug = ? WHERE id = ?', [slug, s.id]);
      console.log(`  ✓ ${s.business_name || '(이름 없음)'} → ${slug}`);
    } catch (e) {
      console.error(`  ✗ ${s.id} 실패:`, e?.message);
    }
  }

  console.log('완료.');
  await pool.end();
}

main().catch((err) => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
