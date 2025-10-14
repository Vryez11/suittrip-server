/**
 * 유효성 검증 유틸리티
 */

/**
 * 이메일 주소 유효성 검증
 * @param {string} email - 이메일 주소
 * @returns {boolean} 유효 여부
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 기반 이메일 정규식
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * 한국 전화번호 유효성 검증
 * @param {string} phoneNumber - 전화번호
 * @returns {boolean} 유효 여부
 */
export const isValidPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  // 한국 전화번호 형식: 010-1234-5678, 01012345678, 02-1234-5678 등
  const phoneRegex = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
  return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
};

/**
 * 사업자 등록번호 유효성 검증
 * @param {string} businessNumber - 사업자 등록번호
 * @returns {boolean} 유효 여부
 */
export const isValidBusinessNumber = (businessNumber) => {
  if (!businessNumber || typeof businessNumber !== 'string') {
    return false;
  }

  // 사업자 등록번호 형식: 123-45-67890 또는 1234567890
  const cleanNumber = businessNumber.replace(/-/g, '');
  const businessRegex = /^\d{10}$/;
  return businessRegex.test(cleanNumber);
};

/**
 * 비밀번호 유효성 검증 (최소 8자)
 * @param {string} password - 비밀번호
 * @returns {boolean} 유효 여부
 */
export const isValidPassword = (password) => {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // 최소 8자 이상
  return password.length >= 8;
};

/**
 * 문자열 정제 (XSS 방지)
 * @param {string} str - 입력 문자열
 * @returns {string} 정제된 문자열
 */
export const sanitizeString = (str) => {
  if (str === null || str === undefined) {
    return '';
  }

  if (typeof str !== 'string') {
    str = String(str);
  }

  // 앞뒤 공백 제거
  str = str.trim();

  // HTML 특수문자 이스케이프
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
};

/**
 * 문자열 길이 검증
 * @param {string} str - 입력 문자열
 * @param {number} min - 최소 길이
 * @param {number} max - 최대 길이
 * @returns {boolean} 유효 여부
 */
export const isValidLength = (str, min, max) => {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const length = str.trim().length;
  return length >= min && length <= max;
};

/**
 * 숫자 범위 검증
 * @param {number} num - 숫자
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {boolean} 유효 여부
 */
export const isInRange = (num, min, max) => {
  if (typeof num !== 'number' || isNaN(num)) {
    return false;
  }

  return num >= min && num <= max;
};
