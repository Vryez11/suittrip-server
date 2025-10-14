/**
 * ID 생성기 유틸리티 테스트
 */

import { describe, test, expect } from '@jest/globals';
import {
  generateStoreId,
  generateReservationId,
  generateStorageId,
  generateReviewId,
  generateNotificationId,
  generateSettlementId,
} from '../../../src/utils/generateId.js';

describe('ID Generator Utility Tests', () => {
  describe('generateStoreId()', () => {
    test('store_ 접두사를 가진 ID를 생성해야 함', () => {
      const id = generateStoreId();

      expect(id).toMatch(/^store_[a-f0-9-]+$/);
      expect(id.startsWith('store_')).toBe(true);
    });

    test('매번 다른 ID를 생성해야 함', () => {
      const id1 = generateStoreId();
      const id2 = generateStoreId();

      expect(id1).not.toBe(id2);
    });

    test('ID 길이가 적절해야 함', () => {
      const id = generateStoreId();

      expect(id.length).toBeGreaterThan(10);
      expect(id.length).toBeLessThan(50);
    });
  });

  describe('generateReservationId()', () => {
    test('rsv_ 접두사를 가진 ID를 생성해야 함', () => {
      const id = generateReservationId();

      expect(id).toMatch(/^rsv_[a-f0-9-]+$/);
      expect(id.startsWith('rsv_')).toBe(true);
    });
  });

  describe('generateStorageId()', () => {
    test('stg_ 접두사를 가진 ID를 생성해야 함', () => {
      const id = generateStorageId();

      expect(id).toMatch(/^stg_[a-f0-9-]+$/);
      expect(id.startsWith('stg_')).toBe(true);
    });
  });

  describe('generateReviewId()', () => {
    test('rev_ 접두사를 가진 ID를 생성해야 함', () => {
      const id = generateReviewId();

      expect(id).toMatch(/^rev_[a-f0-9-]+$/);
      expect(id.startsWith('rev_')).toBe(true);
    });
  });

  describe('generateNotificationId()', () => {
    test('ntf_ 접두사를 가진 ID를 생성해야 함', () => {
      const id = generateNotificationId();

      expect(id).toMatch(/^ntf_[a-f0-9-]+$/);
      expect(id.startsWith('ntf_')).toBe(true);
    });
  });

  describe('generateSettlementId()', () => {
    test('stl_ 접두사를 가진 ID를 생성해야 함', () => {
      const id = generateSettlementId();

      expect(id).toMatch(/^stl_[a-f0-9-]+$/);
      expect(id.startsWith('stl_')).toBe(true);
    });
  });

  describe('고유성 테스트', () => {
    test('1000개의 ID를 생성해도 중복이 없어야 함', () => {
      const ids = new Set();

      for (let i = 0; i < 1000; i++) {
        ids.add(generateStoreId());
      }

      expect(ids.size).toBe(1000);
    });
  });
});
