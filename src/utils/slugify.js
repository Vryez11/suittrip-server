/**
 * slug 생성 유틸리티.
 *
 * 매장명을 URL-safe slug로 변환. 한글 등 ASCII 외 문자는 영문 발음 표기로
 * 매핑하기 어려우므로, 결과가 비면 안전한 짧은 fallback (`store-XXXX`) 으로 대체한다.
 * 공백/특수문자는 하이픈으로 정규화하고, 길이는 60자로 제한.
 */

import crypto from 'crypto';

const MAX_LEN = 60;

/**
 * 입력 문자열을 a-z 0-9 - 만 남기는 slug로 변환.
 * 한글 등 ASCII 외 문자는 모두 제거되므로, 결과가 빌 수 있다.
 */
export const slugify = (input) => {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // 결합 다이아크리틱 제거
    .replace(/[^\w\s-]/g, '')         // [a-z0-9_] + 공백/하이픈만 유지
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_LEN);
};

/**
 * 짧은 랜덤 식별자 (6자) — 충돌 확인 후에도 고유 보장 못 할 때 fallback용.
 */
const shortRandom = () => crypto.randomBytes(4).toString('hex').slice(0, 6);

/**
 * 매장명에서 고유한 slug 생성.
 *
 * @param {string} name - 매장명 (businessName)
 * @param {(slug: string) => Promise<boolean>} existsFn - 해당 slug가 이미 존재하는지 비동기 확인
 * @returns {Promise<string>} 충돌 없는 최종 slug
 *
 * 알고리즘:
 *   1) slugify(name) → base 시도
 *   2) base가 비면 (한글 등) `store-<랜덤6>` 시도
 *   3) base가 충돌하면 `base-2`, `base-3` ... 최대 99까지 시도
 *   4) 그래도 안 되면 `base-<랜덤6>` 으로 강제 충돌 회피
 */
export const generateUniqueSlug = async (name, existsFn) => {
  const base = slugify(name);
  if (!base) {
    // ASCII 외 문자뿐인 매장명 — 의미 있는 slug가 안 나오므로 짧은 랜덤 사용
    let candidate = `store-${shortRandom()}`;
    while (await existsFn(candidate)) {
      candidate = `store-${shortRandom()}`;
    }
    return candidate;
  }

  if (!(await existsFn(base))) return base;

  for (let n = 2; n <= 99; n++) {
    const candidate = `${base}-${n}`;
    if (!(await existsFn(candidate))) return candidate;
  }

  // 100번 시도해도 충돌하면 — 사실상 불가능하지만 안전장치
  let candidate = `${base}-${shortRandom()}`;
  while (await existsFn(candidate)) {
    candidate = `${base}-${shortRandom()}`;
  }
  return candidate;
};
