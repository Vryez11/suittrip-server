/**
 * 알림 라우트
 * Phase 4 - 알림 API 엔드포인트
 */

import express from 'express';
import {
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 알림 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * 알림 목록 조회
 * GET /api/notifications
 * Query params: isRead, type, page, limit
 */
router.get('/', getNotifications);

/**
 * 모든 알림 읽음 처리
 * PUT /api/notifications/read-all
 * Note: 이 라우트는 /:id보다 먼저 정의되어야 함
 */
router.put('/read-all', markAllAsRead);

/**
 * 알림 단일 조회
 * GET /api/notifications/:id
 */
router.get('/:id', getNotification);

/**
 * 알림 읽음 처리
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', markAsRead);

/**
 * 알림 삭제
 * DELETE /api/notifications/:id
 */
router.delete('/:id', deleteNotification);

export default router;
