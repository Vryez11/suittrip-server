/**
 * 고객용 결제 라우트
 * 토스페이먼츠 결제 연동 (고객 앱에서 호출)
 */

import express from 'express';
import {
  preparePayment,
  confirmPayment,
  cancelPayment,
} from '../controllers/paymentController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// 결제 준비 (orderId 발급) — 고객 인증 필요
router.post('/prepare', authenticateCustomer, preparePayment);

// 결제 승인 (토스 결제 완료 후) — 인증 없이 (successUrl 콜백)
router.post('/confirm', confirmPayment);

// 결제 취소 — 고객 인증 필요
router.post('/:paymentKey/cancel', authenticateCustomer, cancelPayment);

export default router;
