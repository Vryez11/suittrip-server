/**
 * 응답 포맷터 유틸리티 테스트
 */

import { describe, test, expect } from '@jest/globals';
import { success, error, paginate } from '../../../src/utils/response.js';

describe('Response Utility Tests', () => {
  describe('success() - 성공 응답', () => {
    test('데이터와 함께 성공 응답을 생성해야 함', () => {
      const data = { id: '123', name: 'Test Store' };
      const result = success(data);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data', data);
      expect(result).not.toHaveProperty('error');
    });

    test('메시지와 함께 성공 응답을 생성해야 함', () => {
      const data = { id: '123' };
      const message = '성공적으로 처리되었습니다.';
      const result = success(data, message);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.message).toBe(message);
    });

    test('데이터 없이도 성공 응답을 생성할 수 있어야 함', () => {
      const result = success();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('error() - 에러 응답', () => {
    test('에러 코드와 메시지로 에러 응답을 생성해야 함', () => {
      const code = 'VALIDATION_ERROR';
      const message = '입력값이 올바르지 않습니다.';
      const result = error(code, message);

      expect(result).toHaveProperty('success', false);
      expect(result.error).toHaveProperty('code', code);
      expect(result.error).toHaveProperty('message', message);
      expect(result.error).toHaveProperty('timestamp');
    });

    test('상세 정보와 함께 에러 응답을 생성해야 함', () => {
      const code = 'VALIDATION_ERROR';
      const message = '유효성 검증 실패';
      const details = { field: 'email', reason: '이메일 형식이 올바르지 않습니다.' };
      const result = error(code, message, details);

      expect(result.error).toHaveProperty('details', details);
    });

    test('statusCode를 포함할 수 있어야 함', () => {
      const result = error('NOT_FOUND', '리소스를 찾을 수 없습니다.', null, 404);

      expect(result.error).toHaveProperty('statusCode', 404);
    });
  });

  describe('paginate() - 페이지네이션 응답', () => {
    test('페이지네이션 메타데이터를 포함해야 함', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const page = 1;
      const limit = 10;
      const total = 25;

      const result = paginate(items, page, limit, total);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(items);
      expect(result.pagination).toHaveProperty('page', page);
      expect(result.pagination).toHaveProperty('limit', limit);
      expect(result.pagination).toHaveProperty('total', total);
      expect(result.pagination).toHaveProperty('totalPages', 3);
      expect(result.pagination).toHaveProperty('hasNext', true);
      expect(result.pagination).toHaveProperty('hasPrev', false);
    });

    test('마지막 페이지에서 hasNext가 false여야 함', () => {
      const items = [{ id: 1 }];
      const result = paginate(items, 3, 10, 25);

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    test('첫 페이지에서 hasPrev가 false여야 함', () => {
      const items = [{ id: 1 }];
      const result = paginate(items, 1, 10, 25);

      expect(result.pagination.hasPrev).toBe(false);
    });
  });
});
