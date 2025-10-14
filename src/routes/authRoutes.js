/**
 * 인증 라우트
 */

import express from 'express';
import {
  sendVerificationCode,
  verifyVerificationCode,
} from '../controllers/authController.js';
import { createEmailVerificationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// 이메일 인증 코드 발송 (Rate Limiting 적용)
router.post('/email/send-verification', createEmailVerificationLimiter(), sendVerificationCode);

// 이메일 인증 코드 검증
router.post('/email/verify-code', verifyVerificationCode);

export default router;
