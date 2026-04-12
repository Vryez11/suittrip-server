/**
 * 고객 전화번호 변경/인증 컨트롤러
 *
 * 외부 SMS API 필요:
 * - 네이버 클라우드 SMS (SENS)  → EXTERNAL_APIS.md 참고
 * - 또는 CoolSMS, Aligo 등
 *
 * 환경변수:
 * - SMS_PROVIDER: 'ncloud' | 'coolsms' | 'mock'
 * - NCLOUD_SMS_SERVICE_ID, NCLOUD_SMS_ACCESS_KEY, NCLOUD_SMS_SECRET_KEY
 * - SMS_SENDER_NUMBER: 발신 번호 (사전 등록 필요)
 */

import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';

const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';

/**
 * 인증 코드 생성 (6자리 숫자)
 */
const generateCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

/**
 * SMS 발송 (외부 API 호출)
 * SMS_PROVIDER 환경변수에 따라 실제 발송 또는 로그 출력
 */
const sendSMS = async (phoneNumber, message) => {
  if (SMS_PROVIDER === 'mock') {
    console.log(`[SMS-MOCK] To: ${phoneNumber}, Message: ${message}`);
    return true;
  }

  if (SMS_PROVIDER === 'ncloud') {
    // 네이버 클라우드 SENS API
    const serviceId = process.env.NCLOUD_SMS_SERVICE_ID;
    const accessKey = process.env.NCLOUD_SMS_ACCESS_KEY;
    const secretKey = process.env.NCLOUD_SMS_SECRET_KEY;
    const senderNumber = process.env.SMS_SENDER_NUMBER;

    if (!serviceId || !accessKey || !secretKey || !senderNumber) {
      console.error('[SMS] 네이버 클라우드 SMS 환경변수 미설정');
      return false;
    }

    try {
      // HMAC-SHA256 서명 생성
      const crypto = await import('crypto');
      const timestamp = String(Date.now());
      const method = 'POST';
      const url = `/sms/v2/services/${serviceId}/messages`;
      const message_to_sign = `${method} ${url}\n${timestamp}\n${accessKey}`;
      const signature = crypto.default
        .createHmac('sha256', secretKey)
        .update(message_to_sign)
        .digest('base64');

      const response = await fetch(
        `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-iam-access-key': accessKey,
            'x-ncp-apigw-signature-v2': signature,
          },
          body: JSON.stringify({
            type: 'SMS',
            from: senderNumber,
            content: message,
            messages: [{ to: phoneNumber.replace(/-/g, '') }],
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('[SMS] 네이버 클라우드 SMS 발송 실패:', errData);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[SMS] 발송 오류:', err);
      return false;
    }
  }

  if (SMS_PROVIDER === 'coolsms') {
    // CoolSMS API
    const apiKey = process.env.COOLSMS_API_KEY;
    const apiSecret = process.env.COOLSMS_API_SECRET;
    const senderNumber = process.env.SMS_SENDER_NUMBER;

    if (!apiKey || !apiSecret || !senderNumber) {
      console.error('[SMS] CoolSMS 환경변수 미설정');
      return false;
    }

    try {
      const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${new Date().toISOString()}, salt=${Date.now()}, signature=placeholder`,
        },
        body: JSON.stringify({
          message: {
            to: phoneNumber.replace(/-/g, ''),
            from: senderNumber,
            text: message,
          },
        }),
      });

      return response.ok;
    } catch (err) {
      console.error('[SMS] CoolSMS 발송 오류:', err);
      return false;
    }
  }

  console.warn(`[SMS] 알 수 없는 SMS_PROVIDER: ${SMS_PROVIDER}`);
  return false;
};

/**
 * 전화번호 변경 요청 (인증코드 발송)
 * POST /api/customer/phone/change
 */
export const requestPhoneChange = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json(error('VALIDATION_ERROR', '변경할 전화번호가 필요합니다'));
    }

    // 전화번호 형식 검증 (한국 휴대폰)
    const cleaned = phoneNumber.replace(/-/g, '');
    if (!/^01[0-9]{8,9}$/.test(cleaned)) {
      return res.status(400).json(error('VALIDATION_ERROR', '올바른 휴대폰 번호 형식이 아닙니다'));
    }

    // 이미 다른 계정에서 사용 중인 번호인지 확인
    const existingUser = await query(
      'SELECT id FROM customers WHERE phone_number = ? AND id != ? LIMIT 1',
      [phoneNumber, customerId]
    );
    if (existingUser && existingUser.length > 0) {
      return res.status(409).json(error('PHONE_ALREADY_IN_USE', '이미 사용 중인 전화번호입니다'));
    }

    // 이전 인증 코드 무효화
    await query(
      'DELETE FROM phone_verifications WHERE customer_id = ? AND verified = 0',
      [customerId]
    );

    // 인증 코드 생성 + 저장
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 유효

    await query(
      `INSERT INTO phone_verifications (customer_id, phone_number, code, expires_at, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [customerId, phoneNumber, code, expiresAt]
    );

    // SMS 발송
    const sent = await sendSMS(phoneNumber, `[LIT] 인증번호: ${code} (5분 내 입력)`);
    if (!sent && SMS_PROVIDER !== 'mock') {
      return res.status(500).json(error('SMS_SEND_FAILED', 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'));
    }

    const response = {
      phoneNumber,
      expiresIn: 300, // 초
      message: 'SMS 인증 코드가 발송되었습니다',
    };

    // 개발 모드에서는 코드도 반환 (테스트 편의)
    if (SMS_PROVIDER === 'mock' || process.env.NODE_ENV === 'development') {
      response.code = code;
    }

    return res.json(success(response));
  } catch (err) {
    console.error('[requestPhoneChange] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(error('DB_MIGRATION_NEEDED', 'phone_verifications 테이블이 없습니다'));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 전화번호 인증 확인
 * POST /api/customer/phone/verify
 */
export const verifyPhone = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json(error('VALIDATION_ERROR', 'phoneNumber, code가 필요합니다'));
    }

    // 인증 코드 조회
    const rows = await query(
      `SELECT id, code, attempts, expires_at as expiresAt
       FROM phone_verifications
       WHERE customer_id = ? AND phone_number = ? AND verified = 0
       ORDER BY created_at DESC LIMIT 1`,
      [customerId, phoneNumber]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json(error('CODE_NOT_FOUND', '인증 요청을 찾을 수 없습니다. 다시 요청해주세요.'));
    }

    const record = rows[0];

    // 만료 확인
    if (new Date(record.expiresAt) < new Date()) {
      await query('DELETE FROM phone_verifications WHERE id = ?', [record.id]);
      return res.status(410).json(error('CODE_EXPIRED', '인증 코드가 만료되었습니다. 다시 요청해주세요.'));
    }

    // 시도 횟수 초과
    if (record.attempts >= 5) {
      await query('DELETE FROM phone_verifications WHERE id = ?', [record.id]);
      return res.status(429).json(error('TOO_MANY_ATTEMPTS', '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.'));
    }

    // 코드 불일치
    if (record.code !== code) {
      await query(
        'UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?',
        [record.id]
      );
      const remaining = 5 - (record.attempts + 1);
      return res.status(400).json(
        error('CODE_MISMATCH', '인증 코드가 일치하지 않습니다', { remainingAttempts: remaining })
      );
    }

    // 인증 성공 → 전화번호 변경
    await query('UPDATE phone_verifications SET verified = 1 WHERE id = ?', [record.id]);
    await query(
      'UPDATE customers SET phone_number = ?, updated_at = NOW() WHERE id = ?',
      [phoneNumber, customerId]
    );

    // 사용된 인증 코드 정리
    await query(
      'DELETE FROM phone_verifications WHERE customer_id = ? AND verified = 1',
      [customerId]
    );

    return res.json(success({
      phoneNumber,
      verified: true,
      message: '전화번호가 변경되었습니다',
    }));
  } catch (err) {
    console.error('[verifyPhone] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};
