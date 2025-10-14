/**
 * 비밀번호 해싱 유틸리티 테스트
 */

import { describe, test, expect } from '@jest/globals';
import { hashPassword, comparePassword, validatePasswordStrength } from '../../../src/utils/password.js';

describe('Password Utility Tests', () => {
  const testPassword = 'SecurePassword123!';

  describe('hashPassword()', () => {
    test('비밀번호를 해싱해야 함', async () => {
      const hash = await hashPassword(testPassword);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(testPassword); // 원본과 달라야 함
      expect(hash.length).toBeGreaterThan(20); // bcrypt 해시는 긴 문자열
    });

    test('동일한 비밀번호도 매번 다른 해시를 생성해야 함 (salt)', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);

      expect(hash1).not.toBe(hash2); // salt 때문에 다름
    });

    test('bcrypt 형식의 해시를 생성해야 함', async () => {
      const hash = await hashPassword(testPassword);

      // bcrypt 해시는 $2b$ 또는 $2a$로 시작
      expect(hash.startsWith('$2')).toBe(true);
    });

    test('빈 문자열 비밀번호는 에러를 발생시켜야 함', async () => {
      await expect(hashPassword('')).rejects.toThrow();
    });

    test('null이나 undefined는 에러를 발생시켜야 함', async () => {
      await expect(hashPassword(null)).rejects.toThrow();
      await expect(hashPassword(undefined)).rejects.toThrow();
    });
  });

  describe('comparePassword()', () => {
    let hashedPassword;

    beforeAll(async () => {
      hashedPassword = await hashPassword(testPassword);
    });

    test('올바른 비밀번호는 true를 반환해야 함', async () => {
      const result = await comparePassword(testPassword, hashedPassword);

      expect(result).toBe(true);
    });

    test('잘못된 비밀번호는 false를 반환해야 함', async () => {
      const result = await comparePassword('WrongPassword123', hashedPassword);

      expect(result).toBe(false);
    });

    test('대소문자를 구분해야 함', async () => {
      const result = await comparePassword(testPassword.toLowerCase(), hashedPassword);

      expect(result).toBe(false);
    });

    test('빈 문자열은 false를 반환해야 함', async () => {
      const result = await comparePassword('', hashedPassword);

      expect(result).toBe(false);
    });

    test('잘못된 해시 형식은 false를 반환해야 함', async () => {
      const result = await comparePassword(testPassword, 'invalid_hash');

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength()', () => {
    test('8자 이상의 비밀번호는 유효해야 함', () => {
      expect(validatePasswordStrength('password123')).toBe(true);
      expect(validatePasswordStrength('12345678')).toBe(true);
    });

    test('8자 미만의 비밀번호는 유효하지 않아야 함', () => {
      expect(validatePasswordStrength('pass')).toBe(false);
      expect(validatePasswordStrength('1234567')).toBe(false);
    });

    test('빈 문자열은 유효하지 않아야 함', () => {
      expect(validatePasswordStrength('')).toBe(false);
    });

    test('null이나 undefined는 유효하지 않아야 함', () => {
      expect(validatePasswordStrength(null)).toBe(false);
      expect(validatePasswordStrength(undefined)).toBe(false);
    });

    test('공백만 있는 비밀번호는 유효하지 않아야 함', () => {
      expect(validatePasswordStrength('        ')).toBe(false);
    });
  });

  describe('성능 테스트', () => {
    test('해싱은 적절한 시간 내에 완료되어야 함 (1초 이내)', async () => {
      const startTime = Date.now();
      await hashPassword(testPassword);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // 1초 이내
    });

    test('비교는 빠르게 처리되어야 함 (500ms 이내)', async () => {
      const hash = await hashPassword(testPassword);
      const startTime = Date.now();
      await comparePassword(testPassword, hash);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // 0.5초 이내
    });
  });

  describe('보안 테스트', () => {
    test('유사한 비밀번호도 완전히 다른 해시를 생성해야 함', async () => {
      const hash1 = await hashPassword('password1');
      const hash2 = await hashPassword('password2');

      expect(hash1).not.toBe(hash2);
      // 해시의 일부만 비교해도 완전히 달라야 함
      expect(hash1.substring(0, 20)).not.toBe(hash2.substring(0, 20));
    });

    test('타이밍 공격을 방지해야 함 (비교 시간이 일정)', async () => {
      const hash = await hashPassword(testPassword);

      // 올바른 비밀번호 비교 시간
      const start1 = Date.now();
      await comparePassword(testPassword, hash);
      const duration1 = Date.now() - start1;

      // 잘못된 비밀번호 비교 시간
      const start2 = Date.now();
      await comparePassword('WrongPassword', hash);
      const duration2 = Date.now() - start2;

      // 시간 차이가 100ms 이내여야 함 (타이밍 공격 방지)
      expect(Math.abs(duration1 - duration2)).toBeLessThan(100);
    });
  });
});
