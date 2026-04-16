/**
 * 비회원 웹 푸시 라우트
 * 인증 불요 — 랜딩페이지에서 직접 호출
 */

import express from 'express';
import { subscribe, getVapidKey } from '../controllers/pushSubscriptionController.js';

const router = express.Router();

/**
 * VAPID 공개키 조회 (프론트에서 구독 시 필요)
 * GET /api/guest/push/vapid-key
 */
router.get('/vapid-key', getVapidKey);

/**
 * 푸시 구독 저장 + 예약 완료 알림 즉시 발송
 * POST /api/guest/push/subscribe
 */
router.post('/subscribe', subscribe);

export default router;
