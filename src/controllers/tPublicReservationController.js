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
const STORAGE_TYPE_NAMES = {
  s: '소형',
  m: '중형',
  l: '대형',
  xl: '특대형',
  special: '특수',
  refrigeration: '냉장',
};

const getDayKey = (date = new Date()) => {
  const day = date.getDay(); // 0: Sun ... 6: Sat
  if (day === 0) return 'sunday';
  if (day === 1) return 'monday';
  if (day === 2) return 'tuesday';
  if (day === 3) return 'wednesday';
  if (day === 4) return 'thursday';
  if (day === 5) return 'friday';
  return 'saturday';
};

const getTodaySchedule = (hoursRow) => {
  if (!hoursRow) {
    return { closeTime: null, isOperating: false };
  }
  const key = getDayKey();
  return {
    closeTime: hoursRow[`${key}_close`] || null,
    openTime: hoursRow[`${key}_open`] || null,
    isOperating: Boolean(hoursRow[`${key}_operating`]),
  };
};

const isOpenNowFromHours = (hoursRow) => {
  const schedule = getTodaySchedule(hoursRow);
  if (!schedule.isOperating || !schedule.openTime || !schedule.closeTime) return false;

  const now = new Date();
  const [openH, openM] = String(schedule.openTime).split(':').map(Number);
  const [closeH, closeM] = String(schedule.closeTime).split(':').map(Number);

  const open = new Date(now);
  open.setHours(openH || 0, openM || 0, 0, 0);
  const close = new Date(now);
  close.setHours(closeH || 0, closeM || 0, 0, 0);
  return now >= open && now <= close;
};

const normalizeTime = (timeValue) => {
  if (!timeValue) return null;
  const str = String(timeValue);
  return str.length >= 5 ? str.slice(0, 5) : str;
};

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

/**
 * 7. 예약 목록 조회 (비회원)
 * GET /api/t/public/reservations?phone={phone}
 */
export const listPublicReservationsByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '전화번호(phone)는 필수입니다.')
      );
    }

    const reservations = await query(
      `SELECT
         id, store_id, status, created_at, confirmed_at,
         requested_storage_type, bag_count, total_amount, start_time, duration
       FROM reservations
       WHERE customer_phone = ?
       ORDER BY created_at DESC`,
      [phone]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(200).json(
        success({
          reservations: [],
          total_count: 0,
        })
      );
    }

    const storeIds = [...new Set(reservations.map((r) => r.store_id).filter(Boolean))];
    const reservationIds = reservations.map((r) => r.id);

    const storePlaceholders = storeIds.map(() => '?').join(',');
    const reservationPlaceholders = reservationIds.map(() => '?').join(',');

    const [stores, statuses, hours, coupons] = await Promise.all([
      query(
        `SELECT id, business_name, business_type, address, phone_number, profile_image_url
         FROM stores
         WHERE id IN (${storePlaceholders})`,
        storeIds
      ),
      query(
        `SELECT s1.store_id, s1.status, s1.today_open_time, s1.today_close_time
         FROM store_status s1
         INNER JOIN (
           SELECT store_id, MAX(updated_at) AS max_updated_at
           FROM store_status
           WHERE store_id IN (${storePlaceholders})
           GROUP BY store_id
         ) s2 ON s1.store_id = s2.store_id AND s1.updated_at = s2.max_updated_at`,
        storeIds
      ),
      query(
        `SELECT *
         FROM store_operating_hours
         WHERE store_id IN (${storePlaceholders})`,
        storeIds
      ),
      query(
        `SELECT
           id, reservation_id, title, type, benefit_item, benefit_value,
           discount_amount, discount_rate, status, expires_at
         FROM coupons
         WHERE reservation_id IN (${reservationPlaceholders})
         ORDER BY created_at DESC`,
        reservationIds
      ),
    ]);

    const storeMap = Object.fromEntries(stores.map((s) => [s.id, s]));
    const statusMap = Object.fromEntries(statuses.map((s) => [s.store_id, s]));
    const hourMap = Object.fromEntries(hours.map((h) => [h.store_id, h]));

    const couponMap = {};
    for (const coupon of coupons) {
      if (!couponMap[coupon.reservation_id]) {
        couponMap[coupon.reservation_id] = coupon;
      }
    }

    const items = reservations.map((reservation) => {
      const store = storeMap[reservation.store_id] || null;
      const status = statusMap[reservation.store_id] || null;
      const hour = hourMap[reservation.store_id] || null;
      const schedule = getTodaySchedule(hour);

      let isCurrentlyOpen = false;
      if (status?.status === 'open') isCurrentlyOpen = true;
      else if (status?.status === 'closed' || status?.status === 'temporarily_closed') isCurrentlyOpen = false;
      else isCurrentlyOpen = isOpenNowFromHours(hour);

      const coupon = couponMap[reservation.id];

      return {
        id: reservation.id,
        status: reservation.status,
        created_at: reservation.created_at,
        confirmed_at: reservation.confirmed_at,
        store: store
          ? {
              id: store.id,
              name: store.business_name,
              category: store.business_type,
              address: store.address,
              phone_number: store.phone_number,
              main_image: store.profile_image_url,
              today_close_time: normalizeTime(status?.today_close_time || schedule.closeTime),
              is_currently_open: isCurrentlyOpen,
            }
          : null,
        luggage_type: reservation.requested_storage_type,
        luggage_type_name: STORAGE_TYPE_NAMES[reservation.requested_storage_type] || reservation.requested_storage_type,
        bag_count: reservation.bag_count,
        total_amount: reservation.total_amount,
        start_time: reservation.start_time,
        duration: reservation.duration,
        coupon: coupon
          ? {
              id: coupon.id,
              title: coupon.title,
              type: coupon.type,
              benefit_item: coupon.benefit_item,
              benefit_value: coupon.benefit_value,
              discount_amount: coupon.discount_amount,
              discount_rate: coupon.discount_rate,
              status: coupon.status,
              expires_at: coupon.expires_at,
            }
          : null,
      };
    });

    return res.status(200).json(
      success({
        reservations: items,
        total_count: items.length,
      })
    );
  } catch (err) {
    console.error('[listPublicReservationsByPhone] error:', err);
    return res.status(500).json(
      error('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다.', { message: err.message })
    );
  }
};
