/**
 * JWT 유틸리티 테스트
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
} from '../../../src/utils/jwt.js';

describe('JWT Utility Tests', () => {
  let testStoreId;
  let testEmail;
  let accessToken;
  let refreshToken;

  beforeAll(() => {
    testStoreId = 'store_test123';
    testEmail = 'test@example.com';
  });

  describe('generateAccessToken()', () => {
    test('Access Token을 생성해야 함', () => {
      accessToken = generateAccessToken(testStoreId, testEmail);

      expect(accessToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(accessToken.split('.').length).toBe(3); // JWT 형식: header.payload.signature
    });

    test('생성된 토큰에 올바른 페이로드가 포함되어야 함', () => {
      const token = generateAccessToken(testStoreId, testEmail);
      const decoded = decodeToken(token);

      expect(decoded).toHaveProperty('storeId', testStoreId);
      expect(decoded).toHaveProperty('email', testEmail);
      expect(decoded).toHaveProperty('type', 'access');
      expect(decoded).toHaveProperty('iat'); // issued at
      expect(decoded).toHaveProperty('exp'); // expiration
    });

    test('만료 시간이 1시간(3600초) 후여야 함', () => {
      const token = generateAccessToken(testStoreId, testEmail);
      const decoded = decodeToken(token);

      const expirationTime = decoded.exp - decoded.iat;
      expect(expirationTime).toBe(3600); // 1시간 = 3600초
    });
  });

  describe('generateRefreshToken()', () => {
    test('Refresh Token을 생성해야 함', () => {
      refreshToken = generateRefreshToken(testStoreId);

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.').length).toBe(3);
    });

    test('생성된 리프레시 토큰에 올바른 페이로드가 포함되어야 함', () => {
      const token = generateRefreshToken(testStoreId);
      const decoded = decodeToken(token);

      expect(decoded).toHaveProperty('storeId', testStoreId);
      expect(decoded).toHaveProperty('type', 'refresh');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    test('만료 시간이 30일 후여야 함', () => {
      const token = generateRefreshToken(testStoreId);
      const decoded = decodeToken(token);

      const expirationTime = decoded.exp - decoded.iat;
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60; // 2592000초
      expect(expirationTime).toBe(thirtyDaysInSeconds);
    });
  });

  describe('verifyAccessToken()', () => {
    test('유효한 Access Token을 검증해야 함', () => {
      const token = generateAccessToken(testStoreId, testEmail);
      const result = verifyAccessToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toHaveProperty('storeId', testStoreId);
      expect(result.payload).toHaveProperty('email', testEmail);
    });

    test('잘못된 토큰은 검증 실패해야 함', () => {
      const result = verifyAccessToken('invalid.token.here');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('만료된 토큰은 검증 실패해야 함', () => {
      // 만료 시간이 매우 짧은 토큰 생성 (테스트용)
      // 실제로는 환경변수로 관리되지만, 테스트에서는 직접 제어
      const expiredToken = generateAccessToken(testStoreId, testEmail, '0s');

      // 약간의 지연 후 검증
      setTimeout(() => {
        const result = verifyAccessToken(expiredToken);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('expired');
      }, 100);
    });

    test('Refresh Token을 Access Token으로 검증하면 실패해야 함', () => {
      const refreshToken = generateRefreshToken(testStoreId);
      const result = verifyAccessToken(refreshToken);

      expect(result.valid).toBe(false);
    });
  });

  describe('verifyRefreshToken()', () => {
    test('유효한 Refresh Token을 검증해야 함', () => {
      const token = generateRefreshToken(testStoreId);
      const result = verifyRefreshToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toHaveProperty('storeId', testStoreId);
      expect(result.payload).toHaveProperty('type', 'refresh');
    });

    test('잘못된 토큰은 검증 실패해야 함', () => {
      const result = verifyRefreshToken('invalid.token.here');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('Access Token을 Refresh Token으로 검증하면 실패해야 함', () => {
      const accessToken = generateAccessToken(testStoreId, testEmail);
      const result = verifyRefreshToken(accessToken);

      expect(result.valid).toBe(false);
    });
  });

  describe('decodeToken()', () => {
    test('토큰을 디코딩해야 함 (검증 없이)', () => {
      const token = generateAccessToken(testStoreId, testEmail);
      const decoded = decodeToken(token);

      expect(decoded).toHaveProperty('storeId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    test('잘못된 형식의 토큰은 null을 반환해야 함', () => {
      const decoded = decodeToken('not.a.valid.jwt');

      expect(decoded).toBeNull();
    });
  });

  describe('보안 테스트', () => {
    test('동일한 입력으로 생성된 토큰은 서로 달라야 함 (iat 때문)', () => {
      const token1 = generateAccessToken(testStoreId, testEmail);

      // 약간의 지연
      setTimeout(() => {
        const token2 = generateAccessToken(testStoreId, testEmail);
        expect(token1).not.toBe(token2);
      }, 10);
    });

    test('토큰에 민감한 정보가 포함되지 않아야 함', () => {
      const token = generateAccessToken(testStoreId, testEmail);
      const decoded = decodeToken(token);

      // 비밀번호나 기타 민감 정보가 없는지 확인
      expect(decoded).not.toHaveProperty('password');
      expect(decoded).not.toHaveProperty('passwordHash');
    });
  });
});
