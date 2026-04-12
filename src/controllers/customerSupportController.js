/**
 * 고객 지원 컨트롤러 (FAQ + 문의 티켓)
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';

/**
 * FAQ 목록 조회
 * GET /api/customer/faq
 */
export const getFAQs = async (req, res) => {
  try {
    const { category } = req.query;

    let sql = 'SELECT id, category, question, answer, display_order as `order` FROM faqs WHERE is_active = 1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY display_order ASC';

    const rows = await query(sql, params);
    return res.json(success(rows || []));
  } catch (err) {
    console.error('[getFAQs] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      // FAQ 테이블 미생성 시 기본 FAQ 반환
      return res.json(success([
        { id: 'faq_001', category: '이용 방법', question: '짐을 맡기려면 어떻게 해야 하나요?', answer: '앱에서 원하는 보관소를 검색하고, 예약 버튼을 눌러 짐 크기와 시간을 선택한 후 결제하면 됩니다.', order: 1 },
        { id: 'faq_002', category: '결제/환불', question: '예약을 취소하면 환불되나요?', answer: '보관 시작 1시간 전까지 취소하면 전액 환불됩니다.', order: 2 },
      ]));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 문의 티켓 생성
 * POST /api/customer/support/tickets
 */
export const createTicket = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { message, category = '일반' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json(error('VALIDATION_ERROR', '문의 내용이 필요합니다'));
    }

    const ticketId = `tkt_${uuidv4()}`;
    const title = message.slice(0, 50);

    await query(
      `INSERT INTO support_tickets (id, customer_id, title, status, priority, category, last_message_at, created_at, updated_at)
       VALUES (?, ?, ?, 'open', 'medium', ?, NOW(), NOW(), NOW())`,
      [ticketId, customerId, title, category]
    );

    // 첫 번째 메시지 삽입
    const messageId = `msg_${uuidv4()}`;
    await query(
      `INSERT INTO support_messages (id, ticket_id, message, is_from_user, created_at)
       VALUES (?, ?, ?, 1, NOW())`,
      [messageId, ticketId, message]
    );

    return res.status(201).json(success({
      id: ticketId,
      title,
      status: 'open',
      priority: 'medium',
      category,
      createdAt: new Date().toISOString(),
    }, '문의가 등록되었습니다'));
  } catch (err) {
    console.error('[createTicket] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(error('DB_MIGRATION_NEEDED', 'support_tickets 테이블이 없습니다'));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 내 문의 티켓 목록 조회
 * GET /api/customer/support/tickets
 */
export const getTickets = async (req, res) => {
  try {
    const customerId = req.customerId;

    const rows = await query(
      `SELECT id, title, status, priority, category,
              last_message_at as lastMessageAt, created_at as createdAt, updated_at as updatedAt
       FROM support_tickets
       WHERE customer_id = ?
       ORDER BY updated_at DESC`,
      [customerId]
    );

    return res.json(success(rows || []));
  } catch (err) {
    console.error('[getTickets] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json(success([]));
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 문의 티켓 상세 조회
 * GET /api/customer/support/tickets/:ticketId
 */
export const getTicket = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { ticketId } = req.params;

    const rows = await query(
      `SELECT id, title, status, priority, category,
              last_message_at as lastMessageAt, created_at as createdAt, updated_at as updatedAt
       FROM support_tickets
       WHERE id = ? AND customer_id = ? LIMIT 1`,
      [ticketId, customerId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json(error('NOT_FOUND', '문의를 찾을 수 없습니다'));
    }

    return res.json(success(rows[0]));
  } catch (err) {
    console.error('[getTicket] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 문의 메시지 목록 조회
 * GET /api/customer/support/tickets/:ticketId/messages
 */
export const getMessages = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { ticketId } = req.params;

    // 본인 티켓인지 확인
    const ticket = await query(
      'SELECT id FROM support_tickets WHERE id = ? AND customer_id = ? LIMIT 1',
      [ticketId, customerId]
    );
    if (!ticket || ticket.length === 0) {
      return res.status(404).json(error('NOT_FOUND', '문의를 찾을 수 없습니다'));
    }

    const rows = await query(
      `SELECT id, ticket_id as ticketId, message, is_from_user as isFromUser, created_at as createdAt
       FROM support_messages
       WHERE ticket_id = ?
       ORDER BY created_at ASC`,
      [ticketId]
    );

    return res.json(success(rows || []));
  } catch (err) {
    console.error('[getMessages] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json(success([]));
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 문의 메시지 보내기
 * POST /api/customer/support/tickets/:ticketId/messages
 */
export const sendMessage = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json(error('VALIDATION_ERROR', '메시지 내용이 필요합니다'));
    }

    // 본인 티켓인지 확인
    const ticket = await query(
      'SELECT id FROM support_tickets WHERE id = ? AND customer_id = ? LIMIT 1',
      [ticketId, customerId]
    );
    if (!ticket || ticket.length === 0) {
      return res.status(404).json(error('NOT_FOUND', '문의를 찾을 수 없습니다'));
    }

    const messageId = `msg_${uuidv4()}`;
    await query(
      `INSERT INTO support_messages (id, ticket_id, message, is_from_user, created_at)
       VALUES (?, ?, ?, 1, NOW())`,
      [messageId, ticketId, message]
    );

    // 티켓 last_message_at 업데이트
    await query(
      'UPDATE support_tickets SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [ticketId]
    );

    return res.status(201).json(success({
      id: messageId,
      ticketId,
      message,
      isFromUser: true,
      createdAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[sendMessage] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};
