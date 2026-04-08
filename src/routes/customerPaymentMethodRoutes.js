/**
 * 고객 결제수단 관리 라우트
 */

import express from 'express';
import { getPaymentMethods, registerPaymentMethod, removePaymentMethod } from '../controllers/customerPaymentMethodController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

router.use(authenticateCustomer);

router.get('/', getPaymentMethods);
router.post('/', registerPaymentMethod);
router.delete('/:methodId', removePaymentMethod);

export default router;
