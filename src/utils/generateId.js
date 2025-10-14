/**
 * ID 생성 유틸리티
 * UUID 기반 고유 ID 생성
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * UUID에서 하이픈 제거
 * @param {string} uuid - UUID 문자열
 * @returns {string} 하이픈이 제거된 UUID
 */
const removeHyphens = (uuid) => uuid.replace(/-/g, '');

/**
 * 접두사와 함께 고유 ID 생성
 * @param {string} prefix - ID 접두사
 * @returns {string} 생성된 ID
 */
const generateId = (prefix) => {
  const uuid = uuidv4();
  return `${prefix}_${uuid}`;
};

/**
 * 점포 ID 생성
 * @returns {string} store_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const generateStoreId = () => {
  return generateId('store');
};

/**
 * 예약 ID 생성
 * @returns {string} rsv_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const generateReservationId = () => {
  return generateId('rsv');
};

/**
 * 보관함 ID 생성
 * @returns {string} stg_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const generateStorageId = () => {
  return generateId('stg');
};

/**
 * 리뷰 ID 생성
 * @returns {string} rev_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const generateReviewId = () => {
  return generateId('rev');
};

/**
 * 알림 ID 생성
 * @returns {string} ntf_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const generateNotificationId = () => {
  return generateId('ntf');
};

/**
 * 정산 ID 생성
 * @returns {string} stl_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const generateSettlementId = () => {
  return generateId('stl');
};

/**
 * 짧은 형식의 ID 생성 (하이픈 제거)
 * @param {string} prefix - ID 접두사
 * @returns {string} 생성된 짧은 ID
 */
export const generateShortId = (prefix) => {
  const uuid = removeHyphens(uuidv4());
  return `${prefix}_${uuid}`;
};
