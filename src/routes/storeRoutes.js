/**
 * 점포 관리 라우트
 */

import express from 'express';
import {
  getStoreStatus,
  updateStoreStatus,
  getStoreInfo,
  updateStoreInfo,
  getStoreSettings,
  updateStoreSettings,
} from '../controllers/storeController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 점포 상태
router.get('/status', getStoreStatus);
router.put('/status', updateStoreStatus);

// 점포 정보
router.get('/', getStoreInfo);
router.put('/', updateStoreInfo);

// 점포 설정
router.get('/settings', getStoreSettings);
router.put('/settings', updateStoreSettings);

export default router;
