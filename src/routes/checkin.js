/**
 * 체크인/보관 중인 짐 라우트
 * Flutter StorageItem 모델과 매핑
 */

import express from 'express';
import { getCheckins, getCheckin, checkoutItem } from '../controllers/checkinController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * @route GET /api/checkins
 * @desc 현재 보관 중인 짐 목록 조회
 * @access Private (점포 인증 필요)
 */
router.get('/', getCheckins);

/**
 * @route GET /api/checkins/:id
 * @desc 보관 중인 짐 단일 조회
 * @access Private (점포 인증 필요)
 */
router.get('/:id', getCheckin);

/**
 * @route PUT /api/checkins/:id/checkout
 * @desc 짐 체크아웃 (픽업 완료)
 * @access Private (점포 인증 필요)
 */
router.put('/:id/checkout', checkoutItem);

export default router;