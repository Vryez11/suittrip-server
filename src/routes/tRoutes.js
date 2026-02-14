/**
 * 랜딩 공개 API 라우트 (/api/t)
 */

import express from 'express';
import { createStoreRegistration, getStoreById } from '../controllers/publicStoreController.js';

const router = express.Router();

// 0. 파트너 등록 신청
router.post('/store-registrations', createStoreRegistration);
router.get('/stores/:storeId', getStoreById);

export default router;
