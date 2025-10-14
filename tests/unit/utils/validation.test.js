/**
 * 유효성 검증 유틸리티 테스트
 */

import { describe, test, expect } from '@jest/globals';
import {
  isValidEmail,
  isValidPhoneNumber,
  isValidBusinessNumber,
  isValidPassword,
  sanitizeString,
} from '../../../src/utils/validation.js';

describe('Validation Utility Tests', () => {
  describe('isValidEmail()', () => {
    test('유효한 이메일 주소를 검증해야 함', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.kr')).toBe(true);
      expect(isValidEmail('test+tag@example.com')).toBe(true);
    });

    test('유효하지 않은 이메일을 거부해야 함', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isValidPhoneNumber()', () => {
    test('유효한 한국 전화번호를 검증해야 함', () => {
      expect(isValidPhoneNumber('010-1234-5678')).toBe(true);
      expect(isValidPhoneNumber('01012345678')).toBe(true);
      expect(isValidPhoneNumber('02-1234-5678')).toBe(true);
      expect(isValidPhoneNumber('0212345678')).toBe(true);
    });

    test('유효하지 않은 전화번호를 거부해야 함', () => {
      expect(isValidPhoneNumber('123-456-7890')).toBe(false);
      expect(isValidPhoneNumber('abcd-efgh-ijkl')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber(null)).toBe(false);
    });
  });

  describe('isValidBusinessNumber()', () => {
    test('유효한 사업자 등록번호 형식을 검증해야 함', () => {
      expect(isValidBusinessNumber('123-45-67890')).toBe(true);
      expect(isValidBusinessNumber('1234567890')).toBe(true);
    });

    test('유효하지 않은 사업자 등록번호를 거부해야 함', () => {
      expect(isValidBusinessNumber('123-45-678')).toBe(false);
      expect(isValidBusinessNumber('12345')).toBe(false);
      expect(isValidBusinessNumber('abc-de-fghij')).toBe(false);
      expect(isValidBusinessNumber('')).toBe(false);
      expect(isValidBusinessNumber(null)).toBe(false);
    });
  });

  describe('isValidPassword()', () => {
    test('유효한 비밀번호를 검증해야 함 (8자 이상)', () => {
      expect(isValidPassword('password123')).toBe(true);
      expect(isValidPassword('SecurePass1!')).toBe(true);
      expect(isValidPassword('12345678')).toBe(true);
    });

    test('너무 짧은 비밀번호를 거부해야 함', () => {
      expect(isValidPassword('pass')).toBe(false);
      expect(isValidPassword('1234567')).toBe(false);
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword(null)).toBe(false);
    });
  });

  describe('sanitizeString()', () => {
    test('문자열의 앞뒤 공백을 제거해야 함', () => {
      expect(sanitizeString('  test  ')).toBe('test');
      expect(sanitizeString('\n\ttest\n\t')).toBe('test');
    });

    test('XSS 공격 가능한 문자를 이스케이프해야 함', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain(
        '<script>'
      );
      expect(sanitizeString('test & test')).toBe('test &amp; test');
      expect(sanitizeString('test < test')).toBe('test &lt; test');
      expect(sanitizeString('test > test')).toBe('test &gt; test');
    });

    test('null이나 undefined를 빈 문자열로 변환해야 함', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    test('일반 문자열은 그대로 반환해야 함', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
      expect(sanitizeString('한글 테스트')).toBe('한글 테스트');
    });
  });
});
