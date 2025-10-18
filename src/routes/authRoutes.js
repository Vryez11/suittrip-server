/**
 * 인증 라우트
 */

import express from 'express';
import {
  sendVerificationCode,
  verifyVerificationCode,
  register,
  login,
  logout,
  refresh,
} from '../controllers/authController.js';
import { createEmailVerificationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// 이메일 인증 코드 발송 (Rate Limiting 적용)
router.post('/email/send-verification', createEmailVerificationLimiter(), sendVerificationCode);

// 이메일 인증 코드 검증
router.post('/email/verify-code', verifyVerificationCode);

// 회원가입
router.post('/register', register);

// 로그인
router.post('/login', login);

// 로그아웃
router.post('/logout', logout);

// 토큰 갱신
router.post('/refresh', refresh);

export default router;
