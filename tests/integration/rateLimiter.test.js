/**
 * Rate Limiter 통합 테스트
 */

import request from 'supertest';
import app from '../../src/app.js';
import { emailVerificationStore } from '../../src/middleware/rateLimiter.js';

describe('Rate Limiter 통합 테스트', () => {
  beforeEach(() => {
    // 각 테스트 전에 rate limiter 초기화
    if (emailVerificationStore && emailVerificationStore.resetAll) {
      emailVerificationStore.resetAll();
    }
  });

  describe('이메일 인증 코드 발송 Rate Limiting', () => {
    const testEmail = 'test@example.com';

    test('첫 번째 요청은 성공해야 함', async () => {
      const response = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('동일 이메일로 60초 내 2번째 요청은 429 에러를 반환해야 함', async () => {
      // 첫 번째 요청
      const firstResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(firstResponse.status).toBe(200);

      // 두 번째 요청 (즉시)
      const secondResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(secondResponse.status).toBe(429);
      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('다른 이메일은 독립적으로 rate limit이 적용되어야 함', async () => {
      // 첫 번째 이메일
      const firstResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: 'first@example.com' });

      expect(firstResponse.status).toBe(200);

      // 두 번째 이메일 (다른 이메일)
      const secondResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: 'second@example.com' });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.success).toBe(true);
    });

    test('이메일 형식이 잘못되면 rate limit 전에 validation 에러를 반환해야 함', async () => {
      const response = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rate limit 초기화 후 다시 요청 가능해야 함', async () => {
      // 첫 번째 요청
      const firstResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(firstResponse.status).toBe(200);

      // 두 번째 요청 (제한됨)
      const secondResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(secondResponse.status).toBe(429);

      // Rate limiter 초기화
      emailVerificationStore.resetAll();

      // 세 번째 요청 (초기화 후)
      const thirdResponse = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(thirdResponse.status).toBe(200);
      expect(thirdResponse.body.success).toBe(true);
    });
  });

  describe('인증 코드 검증 (Rate Limiting 없음)', () => {
    test('인증 코드 검증은 rate limiting이 없어야 함', async () => {
      const testEmail = 'verify@example.com';

      // 여러 번 연속 요청해도 rate limit이 없어야 함
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/email/verify-code')
          .send({ email: testEmail, code: '123456' });

        // rate limit이 아닌 다른 에러 (잘못된 코드 등)가 발생해야 함
        expect(response.status).not.toBe(429);
      }
    });
  });

  describe('emailVerificationStore', () => {
    test('resetAll 메서드가 정상 작동해야 함', () => {
      expect(emailVerificationStore).toBeDefined();
      expect(typeof emailVerificationStore.resetAll).toBe('function');

      // 에러 없이 실행되어야 함
      expect(() => emailVerificationStore.resetAll()).not.toThrow();
    });

    test('increment 메서드가 카운트를 증가시켜야 함', () => {
      const key = 'test@example.com';

      const result1 = emailVerificationStore.increment(key);
      expect(result1.totalHits).toBe(1);

      const result2 = emailVerificationStore.increment(key);
      expect(result2.totalHits).toBe(2);

      // 초기화 후
      emailVerificationStore.resetAll();

      const result3 = emailVerificationStore.increment(key);
      expect(result3.totalHits).toBe(1);
    });

    test('윈도우 시간이 지나면 카운트가 리셋되어야 함', () => {
      const key = 'test@example.com';

      // 첫 번째 요청
      const result1 = emailVerificationStore.increment(key);
      expect(result1.totalHits).toBe(1);

      // resetTime을 과거로 설정하여 시뮬레이션
      emailVerificationStore.data.get(key).resetTime = Date.now() - 1000;

      // 다음 요청은 카운트가 리셋되어야 함
      const result2 = emailVerificationStore.increment(key);
      expect(result2.totalHits).toBe(1);
    });
  });
});
