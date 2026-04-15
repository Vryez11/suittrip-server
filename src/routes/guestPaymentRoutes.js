/**
 * 비회원(게스트) 결제 라우트
 * 인증 불요 — preparePayment를 비회원용으로 래핑
 * confirmPayment는 이미 /api/payments/confirm에서 공개
 */

import express from 'express';
import { preparePayment } from '../controllers/paymentController.js';

const router = express.Router();

/**
 * 비회원 결제 준비
 * POST /api/guest/payments/prepare
 *
 * 기존 preparePayment를 그대로 호출하되,
 * req.customerId가 없으므로 body의 user_id를 사용함
 * (paymentController line 50: const user_id = req.customerId || bodyUserId)
 */
router.post('/prepare', preparePayment);

export default router;
