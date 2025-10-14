/**
 * JWT 토큰 유틸리티
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// JWT 시크릿 키
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET || 'your-secret-key';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET || 'your-refresh-secret-key';

// 토큰 만료 시간
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h'; // 1시간
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d'; // 30일

/**
 * Access Token 생성
 * @param {string} storeId - 점포 ID
 * @param {string} email - 이메일
 * @param {string} expiresIn - 만료 시간 (선택, 기본값: 1h)
 * @returns {string} JWT Access Token
 */
export const generateAccessToken = (storeId, email, expiresIn = ACCESS_TOKEN_EXPIRES_IN) => {
  const payload = {
    storeId,
    email,
    type: 'access',
  };

  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn,
  });
};

/**
 * Refresh Token 생성
 * @param {string} storeId - 점포 ID
 * @param {string} expiresIn - 만료 시간 (선택, 기본값: 30d)
 * @returns {string} JWT Refresh Token
 */
export const generateRefreshToken = (storeId, expiresIn = REFRESH_TOKEN_EXPIRES_IN) => {
  const payload = {
    storeId,
    type: 'refresh',
  };

  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn,
  });
};

/**
 * Access Token 검증
 * @param {string} token - JWT Access Token
 * @returns {Object} { valid: boolean, payload: Object | null, error: string | null }
 */
export const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);

    // 토큰 타입 검증
    if (payload.type !== 'access') {
      return {
        valid: false,
        payload: null,
        error: 'Invalid token type',
      };
    }

    return {
      valid: true,
      payload,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      payload: null,
      error: error.message,
    };
  }
};

/**
 * Refresh Token 검증
 * @param {string} token - JWT Refresh Token
 * @returns {Object} { valid: boolean, payload: Object | null, error: string | null }
 */
export const verifyRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);

    // 토큰 타입 검증
    if (payload.type !== 'refresh') {
      return {
        valid: false,
        payload: null,
        error: 'Invalid token type',
      };
    }

    return {
      valid: true,
      payload,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      payload: null,
      error: error.message,
    };
  }
};

/**
 * 토큰 디코딩 (검증 없이)
 * @param {string} token - JWT Token
 * @returns {Object | null} 디코딩된 페이로드 또는 null
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * 토큰에서 점포 ID 추출
 * @param {string} token - JWT Token
 * @returns {string | null} 점포 ID 또는 null
 */
export const extractStoreId = (token) => {
  const decoded = decodeToken(token);
  return decoded?.storeId || null;
};

/**
 * 토큰 만료 시간 확인
 * @param {string} token - JWT Token
 * @returns {number | null} 만료까지 남은 시간(초) 또는 null
 */
export const getTokenExpirationTime = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = decoded.exp - now;

  return expiresIn > 0 ? expiresIn : 0;
};

/**
 * 토큰이 만료되었는지 확인
 * @param {string} token - JWT Token
 * @returns {boolean} 만료 여부
 */
export const isTokenExpired = (token) => {
  const expiresIn = getTokenExpirationTime(token);
  return expiresIn === null || expiresIn <= 0;
};
