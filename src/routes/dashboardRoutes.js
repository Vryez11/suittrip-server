/**
 * 대시보드 라우트
 * Phase 3 - 대시보드 API 엔드포인트
 */

import express from 'express';
import {
  getDashboardSummary,
  getDashboardStats,
  getDashboardRealtime,
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 대시보드 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * 대시보드 요약 정보 조회
 * GET /api/dashboard/summary
 */
router.get('/summary', getDashboardSummary);

/**
 * 대시보드 통계 조회
 * GET /api/dashboard/stats
 * Query params: period (daily, weekly, monthly, yearly)
 */
router.get('/stats', getDashboardStats);

/**
 * 실시간 대시보드 데이터 조회
 * GET /api/dashboard/realtime
 */
router.get('/realtime', getDashboardRealtime);

export default router;
