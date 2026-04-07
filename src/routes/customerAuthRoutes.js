import express from 'express';
import { socialLogin, signupCustomer, refreshToken, logoutCustomer, withdrawCustomer, getMe } from '../controllers/customerAuthController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

router.post('/social-login', socialLogin);
router.post('/signup', signupCustomer);
router.post('/refresh', refreshToken);
router.post('/logout', logoutCustomer);
router.delete('/withdraw', authenticateCustomer, withdrawCustomer);
router.get('/me', getMe);

export default router;
