/**
 * 비회원(게스트) 예약 라우트
 * 인증 불요 — 웹 랜딩페이지에서 직접 호출
 * Rate limiting으로 남용 방지
 */

import express from 'express';
import {
  createGuestReservation,
  getGuestReservations,
  getGuestReservation,
  cleanupExpiredReservations,
  cancelGuestReservation,
  getAvailability,
} from '../controllers/guestReservationController.js';

const router = express.Router();

// IP 기반 rate limiting (분당 10회)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const guestRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  const entry = rateLimitMap.get(ip);

  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    });
  }

  entry.count++;
  next();
};

// Rate limiter 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// 모든 게스트 라우트에 rate limiting 적용
router.use(guestRateLimit);

/**
 * 비회원 예약 생성
 * POST /api/guest/reservations
 */
router.post('/', createGuestReservation);

/**
 * 미결제 예약 자동 정리 (cron에서 호출)
 * POST /api/guest/reservations/cleanup
 */
router.post('/cleanup', cleanupExpiredReservations);

/**
 * 매장 시간대별 사이즈 가용 수량 조회 (모달 UI 동적 표시용)
 * GET /api/guest/reservations/availability?storeId=&startTime=&duration=
 *
 * 주의: '/:id' 라우트보다 먼저 선언해야 함 (Express 매칭 순서).
 */
router.get('/availability', getAvailability);

/**
 * 비회원 예약 목록 조회 (전화번호 기반)
 * GET /api/guest/reservations?phoneNumber=01012345678
 */
router.get('/', getGuestReservations);

/**
 * 비회원 예약 단건 조회 (토큰 필수)
 * GET /api/guest/reservations/:id?token=xxx
 */
router.get('/:id', getGuestReservation);

/**
 * 비회원 예약 취소 (본인 휴대폰 번호로 검증)
 * PUT /api/guest/reservations/:id/cancel
 * Body: { phoneNumber }
 */
router.put('/:id/cancel', cancelGuestReservation);

export default router;
