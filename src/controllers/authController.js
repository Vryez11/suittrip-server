/**
 * 인증 컨트롤러
 */

import { success, error } from '../utils/response.js';
import { isValidEmail } from '../utils/validation.js';
import {
  generateVerificationCode,
  saveVerificationCode,
  verifyCode,
} from '../utils/emailVerification.js';
import { sendVerificationEmail } from '../config/email.js';
import { query } from '../config/database.js';

/**
 * 이메일 인증 코드 발송
 * POST /api/auth/email/send-verification
 */
export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    // 이메일 검증
    if (!email || !email.trim()) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '이메일이 필요합니다', {
          field: 'email',
        })
      );
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '올바른 이메일 형식이 아닙니다', {
          field: 'email',
        })
      );
    }

    // 이미 등록된 이메일인지 확인
    const existingStores = await query(
      'SELECT id FROM stores WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingStores && existingStores.length > 0) {
      return res.status(400).json(
        error('EMAIL_ALREADY_EXISTS', '이미 등록된 이메일입니다', {
          email,
        })
      );
    }

    // 인증 코드 생성
    const code = generateVerificationCode();

    // DB에 저장
    const saveResult = await saveVerificationCode(email, code);
    if (!saveResult.success) {
      return res.status(500).json(
        error('DATABASE_ERROR', saveResult.error || '인증 코드 저장 실패')
      );
    }

    // 이메일 발송
    const emailResult = await sendVerificationEmail(email, code);
    if (!emailResult.success) {
      return res.status(500).json(
        error('EMAIL_SEND_ERROR', emailResult.error || '이메일 발송 실패')
      );
    }

    return res.json(
      success(
        {
          email,
          expiresIn: 180, // 3분
        },
        '인증 코드가 이메일로 발송되었습니다'
      )
    );
  } catch (err) {
    console.error('인증 코드 발송 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 이메일 인증 코드 검증
 * POST /api/auth/email/verify-code
 */
export const verifyVerificationCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    // 입력 검증
    if (!email || !email.trim()) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '이메일이 필요합니다', {
          field: 'email',
        })
      );
    }

    if (!code || !code.trim()) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '인증 코드가 필요합니다', {
          field: 'code',
        })
      );
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '올바른 이메일 형식이 아닙니다', {
          field: 'email',
        })
      );
    }

    // 코드 검증
    const verifyResult = await verifyCode(email, code);

    if (!verifyResult.success) {
      return res.status(400).json(
        error('VERIFICATION_FAILED', verifyResult.error || '인증 코드 검증 실패', {
          email,
        })
      );
    }

    return res.json(
      success(
        {
          verified: true,
          email,
        },
        '이메일 인증이 완료되었습니다'
      )
    );
  } catch (err) {
    console.error('인증 코드 검증 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};
