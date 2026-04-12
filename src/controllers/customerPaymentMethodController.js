/**
 * 고객 결제수단 관리 컨트롤러
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';

/**
 * 결제수단 목록 조회
 * GET /api/customer/payment-methods
 */
export const getPaymentMethods = async (req, res) => {
  try {
    const customerId = req.customerId;

    const rows = await query(
      `SELECT id, type, name, last_four_digits as lastFourDigits, expiry_date as expiryDate,
              is_default as isDefault, created_at as createdAt
       FROM customer_payment_methods
       WHERE customer_id = ?
       ORDER BY is_default DESC, created_at DESC`,
      [customerId]
    );

    return res.json(success(rows || []));
  } catch (err) {
    console.error('[getPaymentMethods] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json(success([]));
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 결제수단 등록
 * POST /api/customer/payment-methods
 */
export const registerPaymentMethod = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { type, name, lastFourDigits, expiryDate, billingKey, isDefault } = req.body;

    if (!type || !name) {
      return res.status(400).json(error('VALIDATION_ERROR', 'type, name이 필요합니다'));
    }

    if (!['card', 'bank'].includes(type)) {
      return res.status(400).json(error('VALIDATION_ERROR', 'type은 card 또는 bank여야 합니다'));
    }

    const methodId = `pm_${uuidv4()}`;

    // 기본 결제수단으로 설정 시 기존 기본 해제
    if (isDefault) {
      await query(
        'UPDATE customer_payment_methods SET is_default = 0 WHERE customer_id = ?',
        [customerId]
      );
    }

    // 첫 번째 결제수단이면 자동으로 기본 설정
    const existingCount = await query(
      'SELECT COUNT(*) as cnt FROM customer_payment_methods WHERE customer_id = ?',
      [customerId]
    );
    const shouldBeDefault = isDefault || (existingCount[0]?.cnt === 0) ? 1 : 0;

    await query(
      `INSERT INTO customer_payment_methods (id, customer_id, type, name, last_four_digits, expiry_date, is_default, billing_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [methodId, customerId, type, name, lastFourDigits || null, expiryDate || null, shouldBeDefault, billingKey || null]
    );

    return res.status(201).json(success({
      id: methodId,
      type,
      name,
      lastFourDigits,
      expiryDate,
      isDefault: shouldBeDefault,
      createdAt: new Date().toISOString(),
    }, '결제수단이 등록되었습니다'));
  } catch (err) {
    console.error('[registerPaymentMethod] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(error('DB_MIGRATION_NEEDED', 'customer_payment_methods 테이블이 없습니다'));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 결제수단 삭제
 * DELETE /api/customer/payment-methods/:methodId
 */
export const removePaymentMethod = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { methodId } = req.params;

    const result = await query(
      'DELETE FROM customer_payment_methods WHERE id = ? AND customer_id = ?',
      [methodId, customerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(error('NOT_FOUND', '결제수단을 찾을 수 없습니다'));
    }

    return res.json(success({ id: methodId, deleted: true }, '결제수단이 삭제되었습니다'));
  } catch (err) {
    console.error('[removePaymentMethod] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};
