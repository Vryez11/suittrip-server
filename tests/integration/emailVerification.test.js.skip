/**
 * 이메일 인증 통합 테스트
 */

import request from 'supertest';
import app from '../../src/app.js';
import { query } from '../../src/config/database.js';
import {
  generateVerificationCode,
  saveVerificationCode,
  verifyCode,
} from '../../src/utils/emailVerification.js';
import { emailVerificationStore } from '../../src/middleware/rateLimiter.js';

describe('이메일 인증 통합 테스트', () => {
  const testEmail = 'integration-test@example.com';

  beforeEach(async () => {
    // 테스트 전 해당 이메일의 인증 데이터 삭제
    await query('DELETE FROM email_verifications WHERE email = ?', [testEmail]);

    // Rate limiter 초기화
    if (emailVerificationStore && emailVerificationStore.resetAll) {
      emailVerificationStore.resetAll();
    }
  });

  afterEach(async () => {
    // 테스트 후 정리
    await query('DELETE FROM email_verifications WHERE email = ?', [testEmail]);
  });

  describe('인증 코드 생성 및 저장', () => {
    test('6자리 숫자 인증 코드를 생성해야 함', () => {
      const code = generateVerificationCode();

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    test('매번 다른 코드를 생성해야 함', () => {
      const codes = new Set();

      for (let i = 0; i < 100; i++) {
        codes.add(generateVerificationCode());
      }

      // 100번 생성해서 최소 95개 이상은 달라야 함 (확률적으로)
      expect(codes.size).toBeGreaterThan(95);
    });

    test('인증 코드를 데이터베이스에 저장해야 함', async () => {
      const code = generateVerificationCode();
      const result = await saveVerificationCode(testEmail, code);

      expect(result.success).toBe(true);
      expect(result.code).toBe(code);

      // 데이터베이스에서 확인
      const rows = await query(
        'SELECT * FROM email_verifications WHERE email = ? AND is_verified = false',
        [testEmail]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].email).toBe(testEmail);
      expect(rows[0].code).toBe(code);
      expect(rows[0].is_verified).toBe(false);
      expect(rows[0].attempt_count).toBe(0);
    });

    test('이전 미인증 코드를 삭제하고 새 코드를 저장해야 함', async () => {
      // 첫 번째 코드 저장
      const code1 = generateVerificationCode();
      await saveVerificationCode(testEmail, code1);

      // 두 번째 코드 저장
      const code2 = generateVerificationCode();
      await saveVerificationCode(testEmail, code2);

      // 데이터베이스에서 확인 - 하나만 있어야 함
      const rows = await query(
        'SELECT * FROM email_verifications WHERE email = ? AND is_verified = false',
        [testEmail]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].code).toBe(code2);
    });

    test('만료 시간이 3분(180초) 후로 설정되어야 함', async () => {
      const code = generateVerificationCode();
      const beforeSave = Date.now();

      await saveVerificationCode(testEmail, code);

      const afterSave = Date.now();

      const rows = await query(
        'SELECT * FROM email_verifications WHERE email = ?',
        [testEmail]
      );

      const expiresAt = new Date(rows[0].expires_at).getTime();
      const expectedMin = beforeSave + 180 * 1000;
      const expectedMax = afterSave + 180 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('인증 코드 검증', () => {
    test('유효한 코드는 검증에 성공해야 함', async () => {
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      const result = await verifyCode(testEmail, code);

      expect(result.success).toBe(true);
      expect(result.message).toContain('인증');

      // 데이터베이스에서 is_verified가 true로 변경되었는지 확인
      const rows = await query(
        'SELECT * FROM email_verifications WHERE email = ?',
        [testEmail]
      );

      expect(rows[0].is_verified).toBe(true);
    });

    test('잘못된 코드는 검증에 실패해야 함', async () => {
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      const wrongCode = '000000';
      const result = await verifyCode(testEmail, wrongCode);

      expect(result.success).toBe(false);
      expect(result.message).toContain('잘못');

      // attempt_count가 증가했는지 확인
      const rows = await query(
        'SELECT * FROM email_verifications WHERE email = ?',
        [testEmail]
      );

      expect(rows[0].attempt_count).toBe(1);
      expect(rows[0].is_verified).toBe(false);
    });

    test('이미 인증된 코드는 재사용할 수 없어야 함', async () => {
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      // 첫 번째 인증 성공
      const firstResult = await verifyCode(testEmail, code);
      expect(firstResult.success).toBe(true);

      // 두 번째 시도는 실패해야 함
      const secondResult = await verifyCode(testEmail, code);
      expect(secondResult.success).toBe(false);
      expect(secondResult.message).toContain('이미');
    });

    test('만료된 코드는 검증에 실패해야 함', async () => {
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      // 만료 시간을 과거로 변경
      await query(
        'UPDATE email_verifications SET expires_at = ? WHERE email = ?',
        [new Date(Date.now() - 1000), testEmail]
      );

      const result = await verifyCode(testEmail, code);

      expect(result.success).toBe(false);
      expect(result.message).toContain('만료');
    });

    test('최대 시도 횟수(5회)를 초과하면 실패해야 함', async () => {
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      // 5번 실패
      for (let i = 0; i < 5; i++) {
        await verifyCode(testEmail, '000000');
      }

      // 6번째 시도 (올바른 코드라도 실패해야 함)
      const result = await verifyCode(testEmail, code);

      expect(result.success).toBe(false);
      expect(result.message).toContain('시도');
    });

    test('존재하지 않는 이메일은 검증에 실패해야 함', async () => {
      const result = await verifyCode('nonexistent@example.com', '123456');

      expect(result.success).toBe(false);
      expect(result.message).toContain('유효');
    });
  });

  describe('이메일 인증 API 엔드포인트', () => {
    test('POST /api/auth/email/send-verification - 성공 케이스', async () => {
      const response = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testEmail);
      expect(response.body.data.expiresIn).toBe(180);
      expect(response.body.message).toContain('발송');

      // 데이터베이스에 저장되었는지 확인
      const rows = await query(
        'SELECT * FROM email_verifications WHERE email = ?',
        [testEmail]
      );

      expect(rows.length).toBe(1);
    });

    test('POST /api/auth/email/send-verification - 잘못된 이메일 형식', async () => {
      const response = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/auth/email/send-verification - 이미 등록된 이메일', async () => {
      // 먼저 stores 테이블에 이메일 추가
      await query(
        'INSERT INTO stores (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, NOW())',
        ['store_test_001', testEmail, 'hashed_password', 'Test Store']
      );

      const response = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

      // 정리
      await query('DELETE FROM stores WHERE email = ?', [testEmail]);
    });

    test('POST /api/auth/email/verify-code - 성공 케이스', async () => {
      // 먼저 코드 발송
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send({ email: testEmail, code });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('인증');
    });

    test('POST /api/auth/email/verify-code - 잘못된 코드', async () => {
      const code = generateVerificationCode();
      await saveVerificationCode(testEmail, code);

      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send({ email: testEmail, code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('POST /api/auth/email/verify-code - 이메일 형식 검증', async () => {
      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send({ email: 'invalid', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/auth/email/verify-code - 코드 형식 검증', async () => {
      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send({ email: testEmail, code: '12345' }); // 5자리

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('전체 인증 플로우', () => {
    test('코드 발송 -> 검증 -> 재발송 -> 새 코드 검증', async () => {
      // 1. 첫 번째 코드 발송
      const response1 = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(response1.status).toBe(200);

      // 데이터베이스에서 코드 확인
      let rows = await query(
        'SELECT code FROM email_verifications WHERE email = ? AND is_verified = false',
        [testEmail]
      );
      const code1 = rows[0].code;

      // Rate limiter 초기화 (재발송 가능하도록)
      emailVerificationStore.resetAll();

      // 2. 두 번째 코드 발송 (재발송)
      const response2 = await request(app)
        .post('/api/auth/email/send-verification')
        .send({ email: testEmail });

      expect(response2.status).toBe(200);

      // 데이터베이스에서 새 코드 확인
      rows = await query(
        'SELECT code FROM email_verifications WHERE email = ? AND is_verified = false',
        [testEmail]
      );
      const code2 = rows[0].code;

      // 3. 이전 코드로 검증 시도 (실패해야 함)
      const response3 = await request(app)
        .post('/api/auth/email/verify-code')
        .send({ email: testEmail, code: code1 });

      expect(response3.status).toBe(400);

      // 4. 새 코드로 검증 (성공해야 함)
      const response4 = await request(app)
        .post('/api/auth/email/verify-code')
        .send({ email: testEmail, code: code2 });

      expect(response4.status).toBe(200);
      expect(response4.body.success).toBe(true);
    });
  });
});
