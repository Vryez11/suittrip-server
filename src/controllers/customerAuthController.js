/**
 * Customer social login / signup controller (e.g., Kakao)
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';
import { issueCouponsForTrigger } from '../services/couponAutoIssue.js';

dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d';
const KAKAO_USER_ME_URL = 'https://kapi.kakao.com/v2/user/me';

const generateCustomerAccessToken = (customerId, provider) =>
  jwt.sign({ customerId, role: 'customer', provider, type: 'access' }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const generateCustomerRefreshToken = (customerId, provider) =>
  jwt.sign({ customerId, role: 'customer', provider, type: 'refresh' }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

const verifyAccess = (token) => {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (payload.type !== 'access') throw new Error('Invalid token type');
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: e.message };
  }
};

const verifyRefresh = (token) => {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid token type');
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: e.message };
  }
};

class ProviderTokenError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const normalizeProvider = (provider) => String(provider || '').trim().toLowerCase();

const toBit = (val, fallback = 0) => {
  if (val === undefined || val === null) return fallback;
  return val ? 1 : 0;
};

const verifyKakaoAccessToken = async (token) => {
  try {
    const { data } = await axios.get(KAKAO_USER_ME_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 5000,
    });

    if (!data?.id) {
      throw new ProviderTokenError('PROVIDER_TOKEN_INVALID', '카카오 사용자 정보를 확인할 수 없습니다');
    }

    const account = data.kakao_account || {};
    const profile = account.profile || {};
    const properties = data.properties || {};

    return {
      providerId: String(data.id),
      email: account.email || null,
      name: account.name || profile.nickname || properties.nickname || null,
      profileImage: profile.profile_image_url || properties.profile_image || null,
      rawProfile: data,
    };
  } catch (err) {
    if (err instanceof ProviderTokenError) {
      throw err;
    }

    if (err.response?.status === 401) {
      throw new ProviderTokenError('PROVIDER_TOKEN_INVALID', '카카오 accessToken이 유효하지 않습니다');
    }

    if (err.response) {
      throw new ProviderTokenError(
        'PROVIDER_TOKEN_REJECTED',
        err.response.data?.msg || err.response.data?.message || '카카오 accessToken 검증에 실패했습니다',
        401
      );
    }

    throw new ProviderTokenError('PROVIDER_UNAVAILABLE', '카카오 인증 서버에 연결할 수 없습니다', 502);
  }
};

const verifySocialAccessToken = async (providerKey, token) => {
  if (!token) {
    throw new ProviderTokenError('PROVIDER_TOKEN_REQUIRED', 'provider accessToken이 필요합니다', 400);
  }

  if (providerKey === 'kakao') {
    return verifyKakaoAccessToken(token);
  }

  throw new ProviderTokenError(
    'UNSUPPORTED_PROVIDER',
    `지원하지 않는 소셜 로그인 provider입니다: ${providerKey}`,
    400
  );
};

/**
 * 소셜 로그인: 신규면 생성, 기존이면 갱신 후 토큰 발급
 */
export const socialLogin = async (req, res) => {
  try {
    const {
      provider,
      accessToken,
      socialAccessToken,
      refreshToken: providerRefreshToken,
      socialId,
      name,
      email,
      profileImage,
      phoneNumber,
      birthDate,
      carrier,
      gender,
      termsAgreed,
      privacyAgreed,
      locationAgreed,
      marketingAgreed,
    } = req.body;

    const accessTokenInput = accessToken || socialAccessToken;

    if (!provider || !accessTokenInput) {
      return res
        .status(400)
        .json(
          error('VALIDATION_ERROR', 'provider, accessToken이 필요합니다', {
            required: ['provider', 'accessToken'],
          })
        );
    }

    const providerKey = normalizeProvider(provider);
    const verifiedProfile = await verifySocialAccessToken(providerKey, accessTokenInput);

    if (socialId && String(socialId) !== verifiedProfile.providerId) {
      return res.status(401).json(
        error('PROVIDER_ID_MISMATCH', '요청한 socialId가 provider token의 사용자와 일치하지 않습니다')
      );
    }

    const providerId = verifiedProfile.providerId;
    const profileName = verifiedProfile.name || name || null;
    const profileEmail = verifiedProfile.email || email || null;
    const profileImageUrl = verifiedProfile.profileImage || profileImage || null;
    const rawProfile = JSON.stringify(verifiedProfile.rawProfile);

    const existing = await query(
      'SELECT * FROM customers WHERE provider_type = ? AND provider_id = ? LIMIT 1',
      [providerKey, providerId]
    );

    let customerId;
    let isNewUser = false;

    // 탈퇴 회원인지 체크 (name='탈퇴회원'이면 신규 가입으로 처리)
    const isWithdrawn = existing && existing.length > 0 && existing[0].name === '탈퇴회원';

    if (existing && existing.length > 0 && !isWithdrawn) {
      customerId = existing[0].id;
      await query(
        `UPDATE customers
           SET last_login_at = NOW(),
               name = COALESCE(?, name),
               email = COALESCE(?, email),
               phone_number = COALESCE(?, phone_number),
               birth_date = COALESCE(?, birth_date),
               carrier = COALESCE(?, carrier),
               gender = COALESCE(?, gender),
               profile_image_url = COALESCE(?, profile_image_url),
               terms_agreed = COALESCE(?, terms_agreed),
               privacy_agreed = COALESCE(?, privacy_agreed),
               location_agreed = COALESCE(?, location_agreed),
               marketing_agreed = COALESCE(?, marketing_agreed)
         WHERE id = ?`,
        [
          profileName,
          profileEmail,
          phoneNumber || null,
          birthDate || null,
          carrier || null,
          gender || null,
          profileImageUrl,
          toBit(termsAgreed, 0),
          toBit(privacyAgreed, 0),
          toBit(locationAgreed, 0),
          toBit(marketingAgreed, 0),
          customerId,
        ]
      );
    } else {
      isNewUser = true;

      // 탈퇴 회원이면 기존 레코드 정리
      if (isWithdrawn) {
        const oldId = existing[0].id;
        await query('DELETE FROM customer_refresh_tokens WHERE customer_id = ?', [oldId]);
        await query('DELETE FROM customer_auth_providers WHERE customer_id = ?', [oldId]);
        await query('DELETE FROM customers WHERE id = ?', [oldId]);
      }

      customerId = `cust_${uuidv4()}`;
      await query(
        `INSERT INTO customers (id, provider_type, provider_id, name, email, phone_number, birth_date, carrier, gender, profile_image_url, terms_agreed, privacy_agreed, location_agreed, marketing_agreed, last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          customerId,
          providerKey,
          providerId,
          profileName || '사용자',
          profileEmail,
          phoneNumber || null,
          birthDate || null,
          carrier || null,
          gender || null,
          profileImageUrl,
          toBit(termsAgreed, 0),
          toBit(privacyAgreed, 0),
          toBit(locationAgreed, 0),
          toBit(marketingAgreed, 0),
        ]
      );
    }

    // provider 링크 upsert
    const providerLink = await query(
      'SELECT id FROM customer_auth_providers WHERE provider_type = ? AND provider_id = ? LIMIT 1',
      [providerKey, providerId]
    );
    if (providerLink && providerLink.length > 0) {
      await query(
        `UPDATE customer_auth_providers
           SET email = COALESCE(?, email),
               raw_profile = COALESCE(?, raw_profile),
               updated_at = NOW()
         WHERE id = ?`,
        [profileEmail, rawProfile, providerLink[0].id]
      );
    } else {
      await query(
        `INSERT INTO customer_auth_providers (customer_id, provider_type, provider_id, email, raw_profile, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [customerId, providerKey, providerId, profileEmail, rawProfile]
      );

      // 신규 가입 자동 발급 훅
      try {
        await issueCouponsForTrigger({ customerId, storeId: null, trigger: 'signup' });
      } catch (hookErr) {
        console.warn('[socialLogin] auto issue (signup) skipped:', hookErr?.message);
      }
    }

    // 토큰 발급 및 refresh 저장
    const access = generateCustomerAccessToken(customerId, providerKey);
    const refresh = generateCustomerRefreshToken(customerId, providerKey);
    await query(
      `INSERT INTO customer_refresh_tokens (customer_id, token, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())`,
      [customerId, refresh]
    );

    return res.json(
      success({
        isNewUser,
        accessToken: access,
        refreshToken: refresh,
        providerRefreshToken: providerRefreshToken || null,
        userId: customerId,
        customerId,
        name: profileName || existing?.[0]?.name || '사용자',
        email: profileEmail || existing?.[0]?.email || null,
        phoneNumber: phoneNumber || existing?.[0]?.phone_number || null,
        profileImage: profileImageUrl || existing?.[0]?.profile_image_url || null,
        birthDate: birthDate || existing?.[0]?.birth_date || null,
        carrier: carrier || existing?.[0]?.carrier || null,
        gender: gender || existing?.[0]?.gender || null,
        termsAgreed: toBit(termsAgreed, existing?.[0]?.terms_agreed ?? 0),
        privacyAgreed: toBit(privacyAgreed, existing?.[0]?.privacy_agreed ?? 0),
        locationAgreed: toBit(locationAgreed, existing?.[0]?.location_agreed ?? 0),
        marketingAgreed: toBit(marketingAgreed, existing?.[0]?.marketing_agreed ?? 0),
        provider: providerKey,
      })
    );
  } catch (err) {
    console.error('[socialLogin] error:', err);
    if (err instanceof ProviderTokenError) {
      return res.status(err.statusCode).json(error(err.code, err.message));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 신규 회원 가입(온보딩) 완료 처리
 * isNewUser=true 분기에서 호출하는 API
 */
export const signupCustomer = async (req, res) => {
  try {
    const {
      provider,
      socialId,
      accessToken,
      socialAccessToken,
      name,
      email,
      phoneNumber,
      profileImage,
      birthDate,
      carrier,
      gender,
      termsAgreed,
      privacyAgreed,
      locationAgreed,
      marketingAgreed,
    } = req.body;

    const customerId = req.customerId;
    if (!customerId) {
      return res.status(401).json(error('AUTH_REQUIRED', '로그인이 필요합니다'));
    }

    const providerKey = normalizeProvider(provider || req.customer?.provider);
    if (!providerKey) {
      return res.status(400).json(
        error('VALIDATION_ERROR', 'provider가 필요합니다', {
          required: ['provider'],
        })
      );
    }

    const accessTokenInput = accessToken || socialAccessToken;
    let providerId = null;
    let verifiedProfile = null;

    if (accessTokenInput) {
      verifiedProfile = await verifySocialAccessToken(providerKey, accessTokenInput);
      if (socialId && String(socialId) !== verifiedProfile.providerId) {
        return res.status(401).json(
          error('PROVIDER_ID_MISMATCH', '요청한 socialId가 provider token의 사용자와 일치하지 않습니다')
        );
      }
      providerId = verifiedProfile.providerId;
    }

    const existing = await query('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json(error('USER_NOT_FOUND', '사용자를 찾을 수 없습니다'));
    }

    if (providerId && existing[0].provider_id && String(existing[0].provider_id) !== providerId) {
      return res.status(403).json(
        error('PROVIDER_ID_MISMATCH', '로그인 사용자와 provider token의 사용자가 일치하지 않습니다')
      );
    }

    const profileName = verifiedProfile?.name || name || null;
    const profileEmail = verifiedProfile?.email || email || null;
    const profileImageUrl = verifiedProfile?.profileImage || profileImage || null;
    const rawProfile = verifiedProfile ? JSON.stringify(verifiedProfile.rawProfile) : null;

    await query(
      `UPDATE customers
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             phone_number = COALESCE(?, phone_number),
             birth_date = COALESCE(?, birth_date),
             carrier = COALESCE(?, carrier),
             gender = COALESCE(?, gender),
             profile_image_url = COALESCE(?, profile_image_url),
             terms_agreed = COALESCE(?, terms_agreed),
             privacy_agreed = COALESCE(?, privacy_agreed),
             location_agreed = COALESCE(?, location_agreed),
             marketing_agreed = COALESCE(?, marketing_agreed),
             last_login_at = NOW()
       WHERE id = ?`,
      [
        profileName,
        profileEmail,
        phoneNumber || null,
        birthDate || null,
        carrier || null,
        gender || null,
        profileImageUrl,
        toBit(termsAgreed),
        toBit(privacyAgreed, 0),
        toBit(locationAgreed, 0),
        toBit(marketingAgreed, 0),
        customerId,
      ]
    );

    if (providerId) {
      const providerLink = await query(
        'SELECT id FROM customer_auth_providers WHERE provider_type = ? AND provider_id = ? LIMIT 1',
        [providerKey, providerId]
      );
      if (providerLink && providerLink.length > 0) {
        await query(
          `UPDATE customer_auth_providers
             SET email = COALESCE(?, email),
                 raw_profile = COALESCE(?, raw_profile),
                 updated_at = NOW()
           WHERE id = ?`,
          [profileEmail, rawProfile, providerLink[0].id]
        );
      } else {
        await query(
          `INSERT INTO customer_auth_providers (customer_id, provider_type, provider_id, email, raw_profile, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [customerId, providerKey, providerId, profileEmail, rawProfile]
        );
      }
    }

    const access = generateCustomerAccessToken(customerId, providerKey);
    const refresh = generateCustomerRefreshToken(customerId, providerKey);
    await query(
      `INSERT INTO customer_refresh_tokens (customer_id, token, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())`,
      [customerId, refresh]
    );

    return res.json(
      success({
        isNewUser: false,
        accessToken: access,
        refreshToken: refresh,
        userId: customerId,
        customerId,
        name: profileName || existing[0].name || null,
        email: profileEmail || existing[0].email || null,
        phoneNumber: phoneNumber || existing[0].phone_number || null,
        profileImage: profileImageUrl || existing[0].profile_image_url || null,
        birthDate: birthDate || existing[0].birth_date || null,
        carrier: carrier || existing[0].carrier || null,
        gender: gender || existing[0].gender || null,
        termsAgreed: toBit(termsAgreed, existing[0].terms_agreed ?? 0),
        privacyAgreed: toBit(privacyAgreed, existing[0].privacy_agreed ?? 0),
        locationAgreed: toBit(locationAgreed, existing[0].location_agreed ?? 0),
        marketingAgreed: toBit(marketingAgreed, existing[0].marketing_agreed ?? 0),
        provider: providerKey,
      })
    );
  } catch (err) {
    console.error('[signupCustomer] error:', err);
    if (err instanceof ProviderTokenError) {
      return res.status(err.statusCode).json(error(err.code, err.message));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json(error('VALIDATION_ERROR', 'refreshToken이 필요합니다'));
    }

    const verified = verifyRefresh(token);
    if (!verified.valid) {
      return res.status(401).json(error('INVALID_REFRESH_TOKEN', 'refreshToken이 유효하지 않습니다'));
    }

    const { customerId, provider } = verified.payload;
    const records = await query('SELECT id FROM customer_refresh_tokens WHERE token = ? LIMIT 1', [token]);
    if (!records || records.length === 0) {
      return res.status(401).json(error('INVALID_REFRESH_TOKEN', 'refreshToken이 유효하지 않습니다'));
    }

    const access = generateCustomerAccessToken(customerId, provider);
    const newRefresh = generateCustomerRefreshToken(customerId, provider);

    await query(
      `UPDATE customer_refresh_tokens SET token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = ?`,
      [newRefresh, records[0].id]
    );

    return res.json(success({ accessToken: access, refreshToken: newRefresh }));
  } catch (err) {
    console.error('[refreshToken] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

export const logoutCustomer = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await query('DELETE FROM customer_refresh_tokens WHERE token = ?', [token]);
    }
    return res.json(success({ message: '로그아웃 완료' }));
  } catch (err) {
    console.error('[logoutCustomer] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 회원탈퇴 (계정 삭제)
 * DELETE /auth/withdraw
 */
export const withdrawCustomer = async (req, res) => {
  try {
    const customerId = req.customerId;
    if (!customerId) {
      return res.status(401).json(error('AUTH_REQUIRED', '로그인이 필요합니다'));
    }

    // 리프레시 토큰 삭제
    await query('DELETE FROM customer_refresh_tokens WHERE customer_id = ?', [customerId]);

    // 인증 제공자 링크 삭제
    await query('DELETE FROM customer_auth_providers WHERE customer_id = ?', [customerId]);

    // 고객 데이터 소프트 삭제 (개인정보 익명화)
    await query(
      `UPDATE customers
         SET name = '탈퇴회원',
             email = NULL,
             phone_number = NULL,
             birth_date = NULL,
             carrier = NULL,
             gender = NULL,
             profile_image_url = NULL,
             provider_id = CONCAT('withdrawn_', id),
             updated_at = NOW()
       WHERE id = ?`,
      [customerId]
    );

    return res.json(success({ message: '회원탈퇴가 완료되었습니다' }));
  } catch (err) {
    console.error('[withdrawCustomer] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json(error('AUTH_REQUIRED', '토큰이 필요합니다'));
    }

    const verified = verifyAccess(token);
    if (!verified.valid) {
      return res.status(401).json(error('INVALID_TOKEN', '토큰이 유효하지 않습니다'));
    }

    const { customerId } = verified.payload;
    const rows = await query(
      'SELECT id, email, name, phone_number, provider_type, profile_image_url FROM customers WHERE id = ? LIMIT 1',
      [customerId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json(error('USER_NOT_FOUND', '사용자를 찾을 수 없습니다'));
    }

    const user = rows[0];
    return res.json(
      success({
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phone_number,
        provider: user.provider_type,
        profileImage: user.profile_image_url,
      })
    );
  } catch (err) {
    console.error('[getMe] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 프로필 수정
 * PATCH /api/customer/auth/me
 */
export const updateMe = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { name, email, phoneNumber, profileImage } = req.body;

    // 변경할 필드가 없으면 에러
    if (!name && !email && !phoneNumber && profileImage === undefined) {
      return res.status(400).json(error('VALIDATION_ERROR', '변경할 필드가 필요합니다'));
    }

    await query(
      `UPDATE customers SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone_number = COALESCE(?, phone_number),
        profile_image_url = COALESCE(?, profile_image_url),
        updated_at = NOW()
       WHERE id = ?`,
      [name || null, email || null, phoneNumber || null, profileImage ?? null, customerId]
    );

    const rows = await query(
      'SELECT id, email, name, phone_number, provider_type, profile_image_url FROM customers WHERE id = ? LIMIT 1',
      [customerId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json(error('USER_NOT_FOUND', '사용자를 찾을 수 없습니다'));
    }

    const user = rows[0];
    return res.json(
      success({
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phone_number,
        provider: user.provider_type,
        profileImage: user.profile_image_url,
      }, '프로필이 수정되었습니다')
    );
  } catch (err) {
    console.error('[updateMe] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 고객 알림 설정 조회
 * GET /api/auth/notification-settings
 * - customers 테이블에 push_enabled 등 컬럼이 없으면 기본값 반환
 */
export const getNotificationSettings = async (req, res) => {
  try {
    const customerId = req.customerId;
    const [rows] = await query(
      `SELECT push_enabled, email_enabled, sms_enabled, marketing_enabled
       FROM customers WHERE id = ?`,
      [customerId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json(error('NOT_FOUND', '고객 정보를 찾을 수 없습니다'));
    }

    const user = rows[0];
    return res.json(success({
      pushEnabled: user.push_enabled ?? true,
      emailEnabled: user.email_enabled ?? true,
      smsEnabled: user.sms_enabled ?? false,
      marketingEnabled: user.marketing_enabled ?? false,
    }));
  } catch (err) {
    console.error('[getNotificationSettings] error:', err);
    // 컬럼이 없는 경우 기본값 반환
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.json(success({
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        marketingEnabled: false,
      }));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 고객 알림 설정 수정
 * PUT /api/auth/notification-settings
 */
export const updateNotificationSettings = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { pushEnabled, emailEnabled, smsEnabled, marketingEnabled } = req.body;

    await query(
      `UPDATE customers SET
        push_enabled = ?,
        email_enabled = ?,
        sms_enabled = ?,
        marketing_enabled = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        pushEnabled ?? true,
        emailEnabled ?? true,
        smsEnabled ?? false,
        marketingEnabled ?? false,
        customerId,
      ]
    );

    return res.json(success({
      pushEnabled: pushEnabled ?? true,
      emailEnabled: emailEnabled ?? true,
      smsEnabled: smsEnabled ?? false,
      marketingEnabled: marketingEnabled ?? false,
    }));
  } catch (err) {
    console.error('[updateNotificationSettings] error:', err);
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(400).json(error('DB_MIGRATION_NEEDED', 'customers 테이블에 알림 설정 컬럼이 필요합니다. CHANGELOG-jaerok.md 참고'));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

