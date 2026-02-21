/**
 * 랜딩 공개 쿠폰 API 컨트롤러
 */

import { query } from '../config/database.js';
import { comparePassword } from '../utils/password.js';
import { success, error } from '../utils/response.js';

const MAX_PIN_FAILURES = 5;
const PIN_LOCK_MINUTES = 10;

const isValidPinFormat = (pin) => /^[0-9]{4}$|^[0-9]{6}$/.test(String(pin || ''));

/**
 * 6. 쿠폰 사용 (PIN 검증)
 * POST /api/t/public/coupons/use
 */
export const useCouponWithPin = async (req, res) => {
  try {
    const {
      coupon_id: couponId,
      phone,
      store_id: storeId,
      store_pin: storePin,
    } = req.body || {};

    if (!couponId || !phone || !storeId || !storePin) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '필수 정보가 누락되었습니다.', {
          required: ['coupon_id', 'phone', 'store_id', 'store_pin'],
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
      return res.status(400).json(error('STORE_PIN_NOT_SET', '매장 PIN이 설정되어 있지 않습니다.'));
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

    const couponRows = await query(
      `SELECT
         id, store_id, status, used_at, expires_at,
         phone_snapshot, reservation_id
       FROM coupons
       WHERE id = ?
       LIMIT 1`,
      [couponId]
    );

    if (!couponRows || couponRows.length === 0) {
      return res.status(404).json(error('COUPON_NOT_FOUND', '쿠폰을 찾을 수 없습니다.'));
    }

    const coupon = couponRows[0];
    if (coupon.store_id && coupon.store_id !== storeId) {
      return res.status(400).json(error('STORE_MISMATCH', '해당 매장에서 사용할 수 없는 쿠폰입니다.'));
    }

    // 전화번호 검증: snapshot 우선, 없으면 reservation.customer_phone로 검증
    if (coupon.phone_snapshot) {
      if (coupon.phone_snapshot !== phone) {
        return res.status(403).json(error('PHONE_MISMATCH', '본인 확인에 실패했습니다.'));
      }
    } else if (coupon.reservation_id) {
      const reservationRows = await query(
        `SELECT customer_phone FROM reservations WHERE id = ? LIMIT 1`,
        [coupon.reservation_id]
      );

      if (!reservationRows || reservationRows.length === 0 || reservationRows[0].customer_phone !== phone) {
        return res.status(403).json(error('PHONE_MISMATCH', '본인 확인에 실패했습니다.'));
      }
    } else {
      return res.status(400).json(error('PHONE_VERIFY_UNAVAILABLE', '전화번호 검증이 불가능한 쿠폰입니다.'));
    }

    if (coupon.status === 'used') {
      return res.status(400).json(error('ALREADY_USED', '이미 사용된 쿠폰입니다.'));
    }

    if (coupon.status === 'expired') {
      return res.status(400).json(error('EXPIRED', '만료된 쿠폰입니다.'));
    }

    const now = new Date();
    const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;
    if (expiresAt && expiresAt < now) {
      await query(`UPDATE coupons SET status = 'expired', updated_at = NOW() WHERE id = ?`, [couponId]);
      return res.status(400).json(error('EXPIRED', '만료된 쿠폰입니다.'));
    }

    await query(
      `UPDATE coupons
       SET status = 'used',
           used_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [couponId]
    );

    const updatedRows = await query(
      `SELECT id, status, used_at FROM coupons WHERE id = ? LIMIT 1`,
      [couponId]
    );
    const updated = updatedRows[0];

    return res.status(200).json(
      success({
        couponId: updated.id,
        status: updated.status,
        usedAt: updated.used_at,
      })
    );
  } catch (err) {
    console.error('[useCouponWithPin] error:', err);
    return res.status(500).json(
      error('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다.', { message: err.message })
    );
  }
};

