/**
 * 랜딩 공개 예약 API 컨트롤러
 */

import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database.js';
import { comparePassword } from '../utils/password.js';
import { success, error } from '../utils/response.js';

const MAX_PIN_FAILURES = 5;
const PIN_LOCK_MINUTES = 10;
const ALLOWED_CONFIRM_STATUSES = ['pending', 'pending_approval'];

const isValidPinFormat = (pin) => /^[0-9]{4}$|^[0-9]{6}$/.test(String(pin || ''));

/**
 * 5. 예약 확정 (PIN 검증)
 * POST /api/t/public/reservations/confirm
 */
export const confirmReservationWithPin = async (req, res) => {
  try {
    const { reservation_id: reservationId, store_id: storeId, store_pin: storePin } = req.body || {};

    if (!reservationId || !storeId || !storePin) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '필수 정보가 누락되었습니다.', {
          required: ['reservation_id', 'store_id', 'store_pin'],
        })
      );
    }

    if (!isValidPinFormat(storePin)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', 'PIN은 4자리 또는 6자리 숫자여야 합니다.')
      );
    }

    const storeRows = await query(
      `SELECT id, store_pin_hash, store_pin_failed_count, store_pin_locked_until
       FROM stores
       WHERE id = ?
       LIMIT 1`,
      [storeId]
    );

    if (!storeRows || storeRows.length === 0) {
      return res.status(404).json(error('STORE_NOT_FOUND', '매장을 찾을 수 없습니다.'));
    }

    const store = storeRows[0];
    if (!store.store_pin_hash) {
      return res
        .status(400)
        .json(error('STORE_PIN_NOT_SET', '매장 PIN이 설정되어 있지 않습니다.'));
    }

    if (store.store_pin_locked_until && new Date(store.store_pin_locked_until) > new Date()) {
      return res.status(401).json(
        error('PIN_LOCKED', 'PIN 입력이 잠겼습니다. 잠시 후 다시 시도해주세요.', {
          lockedUntil: store.store_pin_locked_until,
        })
      );
    }

    const matched = await comparePassword(String(storePin), store.store_pin_hash);
    if (!matched) {
      const nextFailedCount = Number(store.store_pin_failed_count || 0) + 1;
      const shouldLock = nextFailedCount >= MAX_PIN_FAILURES;

      await query(
        `UPDATE stores
         SET store_pin_failed_count = ?,
             store_pin_locked_until = CASE
               WHEN ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE id = ?`,
        [nextFailedCount, shouldLock ? 1 : 0, PIN_LOCK_MINUTES, storeId]
      );

      return res.status(401).json(error('PIN_MISMATCH', '비밀번호가 일치하지 않습니다.'));
    }

    // PIN 검증 성공 시 실패 카운트/잠금 초기화
    await query(
      `UPDATE stores
       SET store_pin_failed_count = 0,
           store_pin_locked_until = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [storeId]
    );

    const result = await transaction(async (conn) => {
      const [reservationRows] = await conn.query(
        `SELECT
           id, store_id, status, payment_status,
           confirmed_at, updated_at, customer_id, customer_phone
         FROM reservations
         WHERE id = ? AND store_id = ?
         LIMIT 1`,
        [reservationId, storeId]
      );

      if (!reservationRows || reservationRows.length === 0) {
        const err = new Error('예약을 찾을 수 없습니다.');
        err.code = 'RESERVATION_NOT_FOUND';
        throw err;
      }

      const reservation = reservationRows[0];
      if (!ALLOWED_CONFIRM_STATUSES.includes(reservation.status)) {
        const err = new Error('현재 상태에서는 예약 확정이 불가능합니다.');
        err.code = 'INVALID_RESERVATION_STATUS';
        throw err;
      }

      let customerId = reservation.customer_id;
      if (!customerId) {
        customerId = `cust_${Date.now()}`;
        await conn.query(
          `UPDATE reservations
           SET customer_id = ?, updated_at = NOW()
           WHERE id = ?`,
          [customerId, reservationId]
        );
      }

      await conn.query(
        `UPDATE reservations
         SET status = 'confirmed',
             payment_status = 'paid',
             confirmed_at = NOW(),
             updated_at = NOW()
         WHERE id = ? AND store_id = ?`,
        [reservationId, storeId]
      );

      const [updatedReservationRows] = await conn.query(
        `SELECT
           id, store_id, status, payment_status, confirmed_at, updated_at,
           customer_id, customer_phone
         FROM reservations
         WHERE id = ?
         LIMIT 1`,
        [reservationId]
      );
      const updatedReservation = updatedReservationRows[0];

      const [existingCouponRows] = await conn.query(
        `SELECT
           id, title, type, benefit_item, benefit_value, discount_amount, discount_rate, expires_at
         FROM coupons
         WHERE reservation_id = ?
         ORDER BY created_at ASC
         LIMIT 1`,
        [reservationId]
      );

      let coupon = existingCouponRows && existingCouponRows.length > 0 ? existingCouponRows[0] : null;

      if (!coupon) {
        const couponId = `cpn_${uuidv4()}`;
        await conn.query(
          `INSERT INTO coupons (
             id, customer_id, store_id, type, title, description,
             discount_amount, discount_rate, min_spend, max_discount,
             benefit_item, benefit_value, status, issued_at, expires_at,
             used_at, reservation_id, phone_snapshot, payment_id, created_at, updated_at
           ) VALUES (
             ?, ?, ?, 'store_benefit', ?, NULL,
             NULL, NULL, NULL, NULL,
             ?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY),
             NULL, ?, ?, NULL, NOW(), NOW()
           )`,
          [
            couponId,
            customerId,
            storeId,
            '첫 예약 감사 쿠폰',
            '음료',
            '1잔 무료',
            reservationId,
            updatedReservation.customer_phone || null,
          ]
        );

        const [createdCouponRows] = await conn.query(
          `SELECT
             id, title, type, benefit_item, benefit_value, discount_amount, discount_rate, expires_at
           FROM coupons
           WHERE id = ?
           LIMIT 1`,
          [couponId]
        );
        coupon = createdCouponRows[0];
      }

      return {
        reservation: {
          id: updatedReservation.id,
          store_id: updatedReservation.store_id,
          status: updatedReservation.status,
          payment_status: updatedReservation.payment_status,
          confirmed_at: updatedReservation.confirmed_at,
          updated_at: updatedReservation.updated_at,
        },
        coupon,
      };
    });

    return res.status(200).json(
      success({
        reservation: result.reservation,
        coupon: result.coupon,
        message: '예약이 확정되었습니다! 쿠폰이 발급되었어요.',
      })
    );
  } catch (err) {
    if (err.code === 'RESERVATION_NOT_FOUND') {
      return res.status(404).json(error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.'));
    }
    if (err.code === 'INVALID_RESERVATION_STATUS') {
      return res.status(400).json(error('INVALID_RESERVATION_STATUS', err.message));
    }

    console.error('[confirmReservationWithPin] error:', err);
    return res.status(500).json(
      error('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다.', { message: err.message })
    );
  }
};

