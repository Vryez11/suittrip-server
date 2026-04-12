/**
 * 고객 지원 라우트 (FAQ + 문의 티켓)
 */

import express from 'express';
import { getFAQs, createTicket, getTickets, getTicket, getMessages, sendMessage } from '../controllers/customerSupportController.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// FAQ는 인증 없이 조회 가능
router.get('/faq', getFAQs);

// 문의 관련은 인증 필요
router.post('/support/tickets', authenticateCustomer, createTicket);
router.get('/support/tickets', authenticateCustomer, getTickets);
router.get('/support/tickets/:ticketId', authenticateCustomer, getTicket);
router.get('/support/tickets/:ticketId/messages', authenticateCustomer, getMessages);
router.post('/support/tickets/:ticketId/messages', authenticateCustomer, sendMessage);

export default router;
