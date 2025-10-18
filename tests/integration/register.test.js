/**
 * 회원가입 API 통합 테스트
 */

import request from 'supertest';
import app from '../../src/app.js';
import { query } from '../../src/config/database.js';

describe('회원가입 API 통합 테스트', () => {
  const testEmail = 'register-test@example.com';
  const testPassword = 'testpass123';
  const testStoreName = '테스트 매장';

  beforeEach(async () => {
    // 테스트 전 데이터 정리
    await query('DELETE FROM refresh_tokens WHERE store_id LIKE ?', ['store_%']);
    await query('DELETE FROM store_settings WHERE store_id LIKE ?', ['store_%']);
    await query('DELETE FROM store_status WHERE store_id LIKE ?', ['store_%']);
    await query('DELETE FROM stores WHERE email = ?', [testEmail]);
    await query('DELETE FROM email_verifications WHERE email = ?', [testEmail]);
  });

  afterEach(async () => {
    // 테스트 후 데이터 정리
    await query('DELETE FROM refresh_tokens WHERE store_id LIKE ?', ['store_%']);
    await query('DELETE FROM store_settings WHERE store_id LIKE ?', ['store_%']);
    await query('DELETE FROM store_status WHERE store_id LIKE ?', ['store_%']);
    await query('DELETE FROM stores WHERE email = ?', [testEmail]);
    await query('DELETE FROM email_verifications WHERE email = ?', [testEmail]);
  });

  describe('POST /api/auth/register', () => {
    test('필수 필드가 모두 있으면 회원가입에 성공해야 함', async () => {
      // 먼저 이메일 인증 완료 상태로 만들기
      await query(
        'INSERT INTO email_verifications (email, code, is_verified, expires_at, created_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE), NOW())',
        [testEmail, '123456', true]
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: testStoreName,
          phoneNumber: '010-1234-5678',
          businessNumber: '123-45-67890',
          businessName: '테스트 사업체',
          representativeName: '홍길동',
          address: '서울시 강남구',
          detailAddress: '101호',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.store).toBeDefined();
      expect(response.body.data.store.email).toBe(testEmail);
      expect(response.body.data.store.name).toBe(testStoreName);
      expect(response.body.data.store.id).toMatch(/^store_/);
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.tokens.expiresIn).toBe(3600);

      // 데이터베이스에 저장되었는지 확인
      const stores = await query('SELECT * FROM stores WHERE email = ?', [testEmail]);
      expect(stores.length).toBe(1);
      expect(stores[0].name).toBe(testStoreName);

      // store_status가 생성되었는지 확인
      const statuses = await query('SELECT * FROM store_status WHERE store_id = ?', [
        stores[0].id,
      ]);
      expect(statuses.length).toBe(1);
      expect(statuses[0].status).toBe('closed');

      // store_settings가 생성되었는지 확인
      const settings = await query('SELECT * FROM store_settings WHERE store_id = ?', [
        stores[0].id,
      ]);
      expect(settings.length).toBe(1);

      // refresh_tokens가 저장되었는지 확인
      const tokens = await query('SELECT * FROM refresh_tokens WHERE store_id = ?', [
        stores[0].id,
      ]);
      expect(tokens.length).toBe(1);
    });

    test('이메일이 없으면 400 에러를 반환해야 함', async () => {
      const response = await request(app).post('/api/auth/register').send({
        password: testPassword,
        name: testStoreName,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('비밀번호가 8자 미만이면 400 에러를 반환해야 함', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: '1234567',
        name: testStoreName,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('점포명이 없으면 400 에러를 반환해야 함', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
        name: '',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('이메일 인증이 완료되지 않았으면 400 에러를 반환해야 함', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
        name: testStoreName,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    test('이미 가입된 이메일이면 400 에러를 반환해야 함', async () => {
      // 먼저 이메일 인증 완료
      await query(
        'INSERT INTO email_verifications (email, code, is_verified, expires_at, created_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE), NOW())',
        [testEmail, '123456', true]
      );

      // 첫 번째 회원가입 성공
      await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
        name: testStoreName,
      });

      // 두 번째 회원가입 시도 (실패해야 함)
      const response = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
        name: '다른 매장',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    test('선택 필드 없이도 회원가입에 성공해야 함', async () => {
      // 이메일 인증 완료
      await query(
        'INSERT INTO email_verifications (email, code, is_verified, expires_at, created_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 MINUTE), NOW())',
        [testEmail, '123456', true]
      );

      const response = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
        name: testStoreName,
        // 선택 필드들은 제외
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
