/**
 * 고객용 리뷰 CRUD 라우트
 */

import express from 'express';
import { createReview, getMyReviews, updateReview, deleteReview } from '../controllers/customerReviewController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// 모든 라우트에 고객 인증 필요
router.use(authenticateCustomer);

// 내 리뷰 목록 (/:id 보다 먼저 등록해야 'my'가 param으로 잡히지 않음)
router.get('/my', getMyReviews);

// 리뷰 작성
router.post('/', createReview);

// 리뷰 수정
router.patch('/:id', updateReview);

// 리뷰 삭제
router.delete('/:id', deleteReview);

export default router;
