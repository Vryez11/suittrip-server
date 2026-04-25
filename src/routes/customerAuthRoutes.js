import express from 'express';
import { socialLogin, signupCustomer, refreshToken, logoutCustomer, withdrawCustomer, getMe, updateMe, getNotificationSettings, updateNotificationSettings } from '../controllers/customerAuthController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

router.post('/social-login', socialLogin);
router.post('/signup', authenticateCustomer, signupCustomer);
router.post('/refresh', refreshToken);
router.post('/logout', logoutCustomer);
router.delete('/withdraw', authenticateCustomer, withdrawCustomer);
router.get('/me', getMe);
router.patch('/me', authenticateCustomer, updateMe);

// 알림 설정
router.get('/notification-settings', authenticateCustomer, getNotificationSettings);
router.put('/notification-settings', authenticateCustomer, updateNotificationSettings);

export default router;
