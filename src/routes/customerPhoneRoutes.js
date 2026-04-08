/**
 * 고객 전화번호 변경/인증 라우트
 */

import express from 'express';
import { requestPhoneChange, verifyPhone } from '../controllers/customerPhoneController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

router.use(authenticateCustomer);

// 전화번호 변경 요청 (인증코드 발송)
router.post('/change', requestPhoneChange);

// 인증코드 확인 + 전화번호 변경 완료
router.post('/verify', verifyPhone);

export default router;
