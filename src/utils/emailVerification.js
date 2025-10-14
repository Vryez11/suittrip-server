/**
 * 이메일 인증 유틸리티
 */

import dotenv from 'dotenv';
import { query } from '../config/database.js';

dotenv.config();

// 환경변수에서 설정 가져오기
const CODE_LENGTH = parseInt(process.env.EMAIL_VERIFICATION_CODE_LENGTH || '6');
const CODE_EXPIRES_IN = parseInt(process.env.EMAIL_VERIFICATION_CODE_EXPIRES_IN || '180'); // 3분 (초)
const MAX_ATTEMPTS = parseInt(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || '5');

/**
 * 6자리 랜덤 인증 코드 생성
 * @returns {string} 6자리 숫자 코드
 */
export const generateVerificationCode = () => {
  const min = Math.pow(10, CODE_LENGTH - 1); // 100000
  const max = Math.pow(10, CODE_LENGTH) - 1; // 999999
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code.toString();
};

/**
 * 인증 코드를 DB에 저장
 * @param {string} email - 이메일
 * @param {string} code - 인증 코드
 * @returns {Promise<Object>} { success: boolean, code?: string, error?: string }
 */
export const saveVerificationCode = async (email, code) => {
  try {
    // 입력 검증
    if (!email || !email.trim()) {
      return {
        success: false,
        error: '이메일이 필요합니다',
      };
    }

    if (!code || !code.trim()) {
      return {
        success: false,
        error: '인증 코드가 필요합니다',
      };
    }

    // 만료 시간 계산
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_IN * 1000);

    // 기존 미인증 코드 삭제
    await query(
      'DELETE FROM email_verifications WHERE email = ? AND is_verified = false',
      [email]
    );

    // 새 인증 코드 저장
    await query(
      `INSERT INTO email_verifications
       (email, code, expires_at, is_verified, attempt_count)
       VALUES (?, ?, ?, false, 0)`,
      [email, code, expiresAt]
    );

    return {
      success: true,
      code,
    };
  } catch (error) {
    console.error('인증 코드 저장 중 에러:', error);
    return {
      success: false,
      error: error.message || '인증 코드 저장 실패',
    };
  }
};

/**
 * 인증 코드 검증
 * @param {string} email - 이메일
 * @param {string} code - 입력된 인증 코드
 * @returns {Promise<Object>} { success: boolean, verified?: boolean, error?: string }
 */
export const verifyCode = async (email, code) => {
  try {
    // 인증 코드 조회
    const rows = await query(
      `SELECT id, email, code, is_verified, expires_at, attempt_count
       FROM email_verifications
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: '인증 코드를 찾을 수 없습니다',
      };
    }

    const verification = rows[0];

    // 이미 검증된 코드
    if (verification.is_verified) {
      return {
        success: false,
        error: '이미 사용된 코드입니다',
      };
    }

    // 시도 횟수 초과
    if (verification.attempt_count >= MAX_ATTEMPTS) {
      return {
        success: false,
        error: '최대 시도 횟수를 초과했습니다. 새로운 인증 코드를 요청하세요',
      };
    }

    // 만료 확인
    if (isCodeExpired(new Date(verification.expires_at))) {
      return {
        success: false,
        error: '인증 코드가 만료되었습니다. 새로운 코드를 요청하세요',
      };
    }

    // 코드 일치 확인
    if (verification.code !== code) {
      // 시도 횟수 증가
      await query(
        'UPDATE email_verifications SET attempt_count = attempt_count + 1 WHERE id = ?',
        [verification.id]
      );

      return {
        success: false,
        error: '인증 코드가 일치하지 않습니다',
      };
    }

    // 검증 성공 - is_verified를 true로 업데이트
    await query(
      'UPDATE email_verifications SET is_verified = true WHERE id = ?',
      [verification.id]
    );

    return {
      success: true,
      verified: true,
    };
  } catch (error) {
    console.error('인증 코드 검증 중 에러:', error);
    return {
      success: false,
      error: error.message || '인증 코드 검증 실패',
    };
  }
};

/**
 * 코드 만료 여부 확인
 * @param {Date} expiresAt - 만료 시간
 * @returns {boolean} 만료 여부
 */
export const isCodeExpired = (expiresAt) => {
  return new Date(expiresAt) <= new Date();
};

/**
 * 인증 코드 삭제
 * @param {string} email - 이메일
 * @returns {Promise<Object>} { success: boolean, error?: string }
 */
export const deleteVerificationCode = async (email) => {
  try {
    if (!email || !email.trim()) {
      return {
        success: false,
        error: '이메일이 필요합니다',
      };
    }

    await query('DELETE FROM email_verifications WHERE email = ?', [email]);

    return {
      success: true,
    };
  } catch (error) {
    console.error('인증 코드 삭제 중 에러:', error);
    return {
      success: false,
      error: error.message || '인증 코드 삭제 실패',
    };
  }
};

/**
 * 이메일이 검증되었는지 확인
 * @param {string} email - 이메일
 * @returns {Promise<boolean>} 검증 여부
 */
export const isEmailVerified = async (email) => {
  try {
    const rows = await query(
      'SELECT is_verified FROM email_verifications WHERE email = ? AND is_verified = true LIMIT 1',
      [email]
    );

    return rows && rows.length > 0;
  } catch (error) {
    console.error('이메일 검증 확인 중 에러:', error);
    return false;
  }
};
