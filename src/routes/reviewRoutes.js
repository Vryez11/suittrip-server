/**
 * 리뷰 라우트
 * Phase 4 - 리뷰 관리 API 엔드포인트
 */

import express from 'express';
import {
  getReviews,
  getReview,
  createReviewResponse,
  updateReviewResponse,
  deleteReviewResponse,
} from '../controllers/reviewController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 리뷰 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * 리뷰 목록 조회
 * GET /api/reviews
 * Query params: rating, status, type, page, limit
 */
router.get('/', getReviews);

/**
 * 리뷰 단일 조회
 * GET /api/reviews/:id
 */
router.get('/:id', getReview);

/**
 * 리뷰 답글 작성
 * POST /api/reviews/:id/response
 */
router.post('/:id/response', createReviewResponse);

/**
 * 리뷰 답글 수정
 * PUT /api/reviews/:id/response
 */
router.put('/:id/response', updateReviewResponse);

/**
 * 리뷰 답글 삭제
 * DELETE /api/reviews/:id/response
 */
router.delete('/:id/response', deleteReviewResponse);

export default router;
