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
} from '../controllers/guestReservationController.js';

const router = express.Router();

// 간단한 IP 기반 rate limiting (분당 10회)
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
 * 비회원 예약 조회 (전화번호 기반)
 * GET /api/guest/reservations?phone=010-1234-5678
 */
router.get('/', getGuestReservations);

/**
 * 비회원 예약 단건 조회
 * GET /api/guest/reservations/:id
 */
router.get('/:id', getGuestReservation);

export default router;
