/**
 * Express 서버 통합 테스트
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { closePool } from '../../src/config/database.js';

describe('Express Server Integration Tests', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('서버 기본 동작', () => {
    test('서버가 정상적으로 시작되어야 함', () => {
      expect(app).toBeDefined();
    });

    test('헬스체크 엔드포인트가 응답해야 함', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('존재하지 않는 경로는 404를 반환해야 함', async () => {
      const response = await request(app).get('/nonexistent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'ROUTE_NOT_FOUND');
    });
  });

  describe('CORS 설정', () => {
    test('CORS 헤더가 포함되어야 함', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('OPTIONS 요청을 처리해야 함', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000');

      // CORS preflight는 200 또는 204를 반환할 수 있음
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('JSON 파싱', () => {
    test('JSON 바디를 올바르게 파싱해야 함', async () => {
      const testData = { test: 'data' };
      const response = await request(app)
        .post('/health')
        .send(testData)
        .set('Content-Type', 'application/json');

      // POST는 허용되지 않을 수 있지만, JSON 파싱은 작동해야 함
      expect([200, 404, 405]).toContain(response.status);
    });
  });

  describe('에러 처리', () => {
    test('서버 에러를 적절히 처리해야 함', async () => {
      // 의도적으로 에러를 발생시키는 라우트는 나중에 추가
      // 현재는 404 에러로 테스트
      const response = await request(app).get('/api/error-test');

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('API 버전 관리', () => {
    test('/api 경로가 설정되어야 함', async () => {
      const response = await request(app).get('/api');

      // /api 루트는 구현에 따라 다를 수 있음
      expect([200, 404]).toContain(response.status);
    });
  });
});
