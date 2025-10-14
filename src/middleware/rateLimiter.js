/**
 * Rate Limiter 미들웨어
 */

import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { error as errorResponse } from '../utils/response.js';

dotenv.config();

// 환경변수에서 설정 가져오기
const EMAIL_RATE_LIMIT_WINDOW = parseInt(
  process.env.EMAIL_VERIFICATION_RATE_LIMIT_WINDOW || '60'
); // 60초
const EMAIL_RATE_LIMIT_MAX = parseInt(
  process.env.EMAIL_VERIFICATION_RATE_LIMIT_MAX || '1'
); // 1회

// 이메일 인증 전용 스토어 (테스트에서 초기화 가능하도록 export)
export const emailVerificationStore = {
  data: new Map(),

  increment: function (key) {
    const now = Date.now();
    const record = this.data.get(key) || { count: 0, resetTime: now + EMAIL_RATE_LIMIT_WINDOW * 1000 };

    // 시간이 지나면 초기화
    if (now >= record.resetTime) {
      record.count = 0;
      record.resetTime = now + EMAIL_RATE_LIMIT_WINDOW * 1000;
    }

    record.count++;
    this.data.set(key, record);

    return {
      totalHits: record.count,
      resetTime: new Date(record.resetTime),
    };
  },

  decrement: function (key) {
    const record = this.data.get(key);
    if (record) {
      record.count = Math.max(0, record.count - 1);
    }
  },

  resetKey: function (key) {
    this.data.delete(key);
  },

  resetAll: function () {
    this.data.clear();
  },
};

/**
 * 이메일 인증 전용 Rate Limiter
 * 동일 이메일로 1분에 1회만 인증 코드 발송 가능
 */
export const createEmailVerificationLimiter = () => {
  return rateLimit({
    windowMs: EMAIL_RATE_LIMIT_WINDOW * 1000, // 초를 밀리초로 변환
    max: EMAIL_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    // 이메일 기반 키 생성 (이메일이 없으면 IP 사용)
    keyGenerator: (req) => {
      return req.body?.email || req.ip || 'unknown';
    },
    validate: false, // IPv6 validation 비활성화
    store: emailVerificationStore,
    // 커스텀 에러 메시지
    handler: (req, res) => {
      const retryAfter = Math.ceil(EMAIL_RATE_LIMIT_WINDOW);
      res.status(429).json(
        errorResponse(
          'RATE_LIMIT_EXCEEDED',
          `인증 코드는 ${EMAIL_RATE_LIMIT_WINDOW}초에 1회만 요청할 수 있습니다. ${retryAfter}초 후에 다시 시도해주세요.`,
          {
            retryAfter,
            windowMs: EMAIL_RATE_LIMIT_WINDOW * 1000,
          }
        )
      );
    },
    skip: (req) => {
      // 테스트 환경에서는 rate limit 비활성화 옵션
      return process.env.NODE_ENV === 'test' && process.env.DISABLE_RATE_LIMIT === 'true';
    },
  });
};

/**
 * 일반 API Rate Limiter
 * @param {Object} options - Rate limit 옵션
 * @param {number} options.windowMs - 시간 윈도우 (밀리초)
 * @param {number} options.max - 최대 요청 수
 * @returns {Function} Rate limiter 미들웨어
 */
export const createGeneralRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60000; // 기본 1분
  const max = options.max || 100; // 기본 100회

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.status(429).json(
        errorResponse(
          'RATE_LIMIT_EXCEEDED',
          `너무 많은 요청을 보냈습니다. ${retryAfter}초 후에 다시 시도해주세요.`,
          {
            retryAfter,
            windowMs,
            max,
          }
        )
      );
    },
    skip: (req) => {
      return process.env.NODE_ENV === 'test' && process.env.DISABLE_RATE_LIMIT === 'true';
    },
  });
};

/**
 * IP 기반 Rate Limiter (로그인, 회원가입 등)
 */
export const authRateLimiter = createGeneralRateLimiter({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 5회
});

/**
 * 일반 API Rate Limiter
 */
export const apiRateLimiter = createGeneralRateLimiter({
  windowMs: 60 * 1000, // 1분
  max: 100, // 100회
});
