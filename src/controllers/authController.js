/**
 * 인증 컨트롤러
 */

import { success, error } from '../utils/response.js';
import { isValidEmail, isValidPassword } from '../utils/validation.js';
import {
  generateVerificationCode,
  saveVerificationCode,
  verifyCode,
} from '../utils/emailVerification.js';
import { sendVerificationEmail } from '../config/email.js';
import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { generateStoreId } from '../utils/generateId.js';

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

/**
 * 회원가입
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      phoneNumber,
      businessNumber,
      businessName,
      representativeName,
      address,
      detailAddress,
      latitude,
      longitude,
      businessType,
      description,
    } = req.body;

    // 필수 필드 검증
    if (!email || !email.trim()) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '이메일이 필요합니다', { field: 'email' })
      );
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '올바른 이메일 형식이 아닙니다', {
          field: 'email',
        })
      );
    }

    if (!password || !password.trim()) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '비밀번호가 필요합니다', {
          field: 'password',
        })
      );
    }

    if (!isValidPassword(password)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '비밀번호는 8자 이상이어야 합니다', {
          field: 'password',
        })
      );
    }

    if (!name || !name.trim()) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '점포명이 필요합니다', { field: 'name' })
      );
    }

    // 1. 이메일 인증 확인
    const verificationRecords = await query(
      'SELECT email, is_verified FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    if (!verificationRecords || verificationRecords.length === 0) {
      return res.status(400).json(
        error('EMAIL_NOT_VERIFIED', '이메일 인증이 필요합니다', { email })
      );
    }

    if (!verificationRecords[0].is_verified) {
      return res.status(400).json(
        error('EMAIL_NOT_VERIFIED', '이메일 인증이 완료되지 않았습니다', {
          email,
        })
      );
    }

    // 2. 이메일 중복 확인
    const existingStores = await query(
      'SELECT id FROM stores WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingStores && existingStores.length > 0) {
      return res.status(400).json(
        error('EMAIL_ALREADY_EXISTS', '이미 등록된 이메일입니다', { email })
      );
    }

    // 3. 비밀번호 해싱
    const passwordHash = await hashPassword(password);

    // 4. 점포 ID 생성
    const storeId = generateStoreId();

    // 5. 점포 정보 저장
    await query(
      `INSERT INTO stores (
        id, email, password_hash, name, phone_number,
        business_number, business_name, representative_name,
        address, detail_address, latitude, longitude,
        business_type, description, has_completed_setup,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        storeId,
        email,
        passwordHash,
        name,
        phoneNumber || null,
        businessNumber || null,
        businessName || null,
        representativeName || null,
        address || null,
        detailAddress || null,
        latitude || null,
        longitude || null,
        businessType || null,
        description || null,
        false, // has_completed_setup
      ]
    );

    // 6. 초기 store_status 생성
    await query(
      `INSERT INTO store_status (
        store_id, status, reason, created_at, updated_at
      ) VALUES (?, ?, ?, NOW(), NOW())`,
      [storeId, 'closed', '신규 가입']
    );

    // 7. 초기 store_settings 생성
    await query(
      `INSERT INTO store_settings (
        store_id, created_at, updated_at
      ) VALUES (?, NOW(), NOW())`,
      [storeId]
    );

    // 8. JWT 토큰 발급
    const accessToken = generateAccessToken(storeId, email);
    const refreshToken = generateRefreshToken(storeId, email);

    // 9. Refresh Token 저장
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후

    await query(
      `INSERT INTO refresh_tokens (
        store_id, token, expires_at, created_at
      ) VALUES (?, ?, ?, NOW())`,
      [storeId, refreshToken, expiresAt]
    );

    // 10. 응답
    return res.status(201).json(
      success(
        {
          store: {
            id: storeId,
            email,
            name,
            hasCompletedSetup: false,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 3600, // 1시간 (초 단위)
          },
        },
        '회원가입이 완료되었습니다'
      )
    );
  } catch (err) {
    console.error('회원가입 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};
