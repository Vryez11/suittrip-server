/**
 * 비밀번호 해싱 유틸리티
 */

import bcrypt from 'bcryptjs';

// Salt rounds (해싱 강도, 높을수록 안전하지만 느림)
const SALT_ROUNDS = 10;

/**
 * 비밀번호 해싱
 * @param {string} password - 평문 비밀번호
 * @returns {Promise<string>} 해시된 비밀번호
 * @throws {Error} 비밀번호가 유효하지 않으면 에러
 */
export const hashPassword = async (password) => {
  // 입력 검증
  if (!password || typeof password !== 'string') {
    throw new Error('비밀번호는 문자열이어야 합니다.');
  }

  if (password.trim().length === 0) {
    throw new Error('비밀번호는 비어있을 수 없습니다.');
  }

  try {
    // bcrypt로 해싱
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error(`비밀번호 해싱 실패: ${error.message}`);
  }
};

/**
 * 비밀번호 비교 (검증)
 * @param {string} password - 평문 비밀번호
 * @param {string} hashedPassword - 해시된 비밀번호
 * @returns {Promise<boolean>} 일치 여부
 */
export const comparePassword = async (password, hashedPassword) => {
  // 입력 검증
  if (!password || typeof password !== 'string') {
    return false;
  }

  if (!hashedPassword || typeof hashedPassword !== 'string') {
    return false;
  }

  try {
    // bcrypt로 비교
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    // 잘못된 해시 형식 등의 에러는 false 반환
    console.error('비밀번호 비교 실패:', error.message);
    return false;
  }
};

/**
 * 비밀번호 강도 검증 (최소 8자)
 * @param {string} password - 평문 비밀번호
 * @returns {boolean} 유효 여부
 */
export const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // 공백 제거 후 길이 확인
  const trimmedPassword = password.trim();

  if (trimmedPassword.length === 0) {
    return false;
  }

  // 최소 8자 이상
  return trimmedPassword.length >= 8;
};

/**
 * 비밀번호 강도 레벨 반환 (확장용)
 * @param {string} password - 평문 비밀번호
 * @returns {Object} { level: string, score: number, feedback: string[] }
 */
export const getPasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      level: 'invalid',
      score: 0,
      feedback: ['비밀번호를 입력해주세요.'],
    };
  }

  const feedback = [];
  let score = 0;

  // 길이 체크
  if (password.length >= 8) {
    score += 25;
  } else {
    feedback.push('최소 8자 이상이어야 합니다.');
  }

  if (password.length >= 12) {
    score += 25;
  }

  // 소문자 포함
  if (/[a-z]/.test(password)) {
    score += 12;
  } else {
    feedback.push('소문자를 포함하면 더 안전합니다.');
  }

  // 대문자 포함
  if (/[A-Z]/.test(password)) {
    score += 12;
  } else {
    feedback.push('대문자를 포함하면 더 안전합니다.');
  }

  // 숫자 포함
  if (/[0-9]/.test(password)) {
    score += 13;
  } else {
    feedback.push('숫자를 포함하면 더 안전합니다.');
  }

  // 특수문자 포함
  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 13;
  } else {
    feedback.push('특수문자를 포함하면 더 안전합니다.');
  }

  // 레벨 판정
  let level;
  if (score >= 80) {
    level = 'strong';
  } else if (score >= 60) {
    level = 'medium';
  } else if (score >= 40) {
    level = 'weak';
  } else {
    level = 'very_weak';
  }

  return {
    level,
    score,
    feedback: feedback.length > 0 ? feedback : ['안전한 비밀번호입니다.'],
  };
};
