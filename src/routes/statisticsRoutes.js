/**
 * 통계 라우트
 * Phase 4 - 통계 API 엔드포인트
 */

import express from 'express';
import {
  getDailyStatistics,
  getMonthlyStatistics,
  getRevenueStatistics,
} from '../controllers/statisticsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 통계 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * 일별 통계 조회
 * GET /api/statistics/daily
 * Query params: startDate, endDate
 */
router.get('/daily', getDailyStatistics);

/**
 * 월별 통계 조회
 * GET /api/statistics/monthly
 * Query params: year
 */
router.get('/monthly', getMonthlyStatistics);

/**
 * 매출 통계 조회
 * GET /api/statistics/revenue
 * Query params: period (daily, weekly, monthly, yearly), startDate, endDate
 */
router.get('/revenue', getRevenueStatistics);

export default router;
