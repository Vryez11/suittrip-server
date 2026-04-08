/**
 * 고객 디바이스(푸시토큰) 관리 라우트
 */

import express from 'express';
import { registerDevice, getDevices, removeDevice } from '../controllers/customerDeviceController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// 모든 라우트에 고객 인증 필요
router.use(authenticateCustomer);

// 디바이스 등록/업데이트
router.post('/', registerDevice);

// 내 디바이스 목록 조회
router.get('/', getDevices);

// 디바이스 삭제
router.delete('/:deviceId', removeDevice);

export default router;
