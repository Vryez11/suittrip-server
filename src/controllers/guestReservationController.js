/**
 * Guest Reservation Controller
 * 비회원(웹) 예약 생성/조회 — 인증 불요
 *
 * P1 보안/안정성 항목 반영:
 * - URL 토큰 기반 예약 조회 (전화번호만으로 조회 불가)
 * - 매장 capacity 검증 (시간대별 수용량 체크)
 * - 미결제 예약 TTL 정리 (30분)
 */

import { success, error } from '../utils/response.js';
import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const ALLOWED_STORAGE_TYPES = ['s', 'm', 'l', 'xl', 'special', 'refrigeration'];
const PRICE_PER_BAG_PER_DAY = 6000;
const RESERVATION_TTL_MINUTES = 30;

const toMySQLDateTime = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const normalizePhone = (phone) => String(phone || '').replace(/[-\s]/g, '');

/**
 * id OR slug → canonical store 정보로 정규화.
 * UUID/slug 둘 다 받아 동일하게 동작하게 만들어 클라이언트가 UUID를 노출할 필요가 없게 한다.
 * 매장이 없으면 null 반환.
 *
 * 반환: { id, name } | null
 */
const resolveStore = async (idOrSlug) => {
  if (!idOrSlug) return null;
  const rows = await query(
    'SELECT id, business_name AS name FROM stores WHERE id = ? OR slug = ? LIMIT 1',
    [idOrSlug, idOrSlug]
  );
  const row = rows?.[0];
  return row ? { id: row.id, name: row.name } : null;
};

/**
 * URL-safe 액세스 토큰 생성 (16바이트 = 22자 base64url)
 */
const generateAccessToken = () => {
  return crypto.randomBytes(16).toString('base64url');
};

/**
 * 매장 capacity 검증
 * 해당 시간대에 이미 예약된 짐 개수가 max_capacity를 초과하는지 체크
 */
const checkCapacity = async (storeId, storageType, startTime, endTime, bagCount) => {
  // SQL injection 방지: 동적 컬럼명이므로 반드시 화이트리스트 검증
  if (!ALLOWED_STORAGE_TYPES.includes(storageType)) {
    throw new Error(`Invalid storage type: ${storageType}`);
  }
  const capacityColumn = `${storageType}_max_capacity`;

  const [config] = await query(
    `SELECT ${capacityColumn} as maxCapacity FROM store_settings WHERE store_id = ? LIMIT 1`,
    [storeId]
  );

  if (!config) {
    // 설정 없으면 기본값 사용 (제한 없음은 위험하므로 5개로 제한)
    return { available: true, maxCapacity: 5, currentCount: 0 };
  }

  const maxCapacity = config.maxCapacity || 5;

  // 겹치는 시간대의 활성 예약 짐 개수 합산
  const [result] = await query(
    `SELECT COALESCE(SUM(bag_count), 0) as totalBags
     FROM reservations
     WHERE store_id = ?
       AND requested_storage_type = ?
       AND status IN ('pending', 'confirmed', 'in_progress')
       AND payment_status != 'refunded'
       AND start_time < ?
       AND end_time > ?`,
    [storeId, storageType, toMySQLDateTime(endTime), toMySQLDateTime(startTime)]
  );

  const currentCount = result?.totalBags || 0;
  const available = (currentCount + bagCount) <= maxCapacity;

  return { available, maxCapacity, currentCount };
};

/**
 * 비회원 예약 생성
 * POST /api/guest/reservations
 */
export const createGuestReservation = async (req, res) => {
  try {
    const {
      storeId,
      customerName,
      phoneNumber,
      email,
      customerEmail,
      startTime,
      endTime,
      duration,
      bagCount,
      storageType,
      requestedStorageType,
      message,
      payment_key,
      paymentKey,
      order_id,
      orderId,
    } = req.body;
    // Landing serializer는 requestedStorageType / customerEmail / paymentKey / orderId 로 보내고
    // 본 컨트롤러는 storageType / email / payment_key / order_id 로 받던 미스매치를 둘 다 수용.
    const effectiveStorageType = storageType || requestedStorageType || 's';
    const effectiveEmail = email || customerEmail;
    const effectivePaymentKey = payment_key || paymentKey;
    const effectiveOrderId = order_id || orderId;

    // 필수 필드 검증
    if (!storeId || !customerName || !phoneNumber || !startTime || !duration || !bagCount) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '필수 정보가 누락되었습니다', {
          required: ['storeId', 'customerName', 'phoneNumber', 'startTime', 'duration', 'bagCount'],
        })
      );
    }

    if (!ALLOWED_STORAGE_TYPES.includes(effectiveStorageType)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '유효하지 않은 보관 타입입니다', { allowed: ALLOWED_STORAGE_TYPES })
      );
    }

    if (bagCount < 1 || bagCount > 10) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '짐 개수는 1~10개 사이여야 합니다')
      );
    }

    const cleanedPhone = normalizePhone(phoneNumber);
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '올바른 전화번호를 입력해주세요')
      );
    }

    // 매장 존재 확인 + storeId가 slug면 canonical id로 정규화
    // (Landing이 UUID 대신 slug를 보낼 수 있도록 — 네트워크 탭에서 UUID 노출 차단 목적)
    const store = await resolveStore(storeId);
    if (!store) {
      return res.status(404).json(error('STORE_NOT_FOUND', '매장을 찾을 수 없습니다'));
    }
    const canonicalStoreId = store.id;

    // endTime 계산
    let calculatedEndTime = endTime;
    if (!calculatedEndTime && startTime && duration) {
      const start = new Date(startTime);
      start.setHours(start.getHours() + Number(duration));
      calculatedEndTime = start.toISOString();
    }

    // capacity 검증
    const capacity = await checkCapacity(canonicalStoreId, effectiveStorageType, startTime, calculatedEndTime, bagCount);
    if (!capacity.available) {
      return res.status(409).json(
        error('CAPACITY_EXCEEDED', '해당 시간대에 수용 가능한 공간이 부족합니다', {
          maxCapacity: capacity.maxCapacity,
          currentCount: capacity.currentCount,
          requested: bagCount,
        })
      );
    }

    // 금액 계산
    const totalAmount = PRICE_PER_BAG_PER_DAY * bagCount;

    // 비회원 고유 ID + 액세스 토큰 생성
    const customerId = `guest_${cleanedPhone}_${Date.now()}`;
    const reservationId = `res_${uuidv4()}`;
    const accessToken = generateAccessToken();

    // 결제→예약 플로우: 트랜잭션으로 결제 검증 + 예약 생성 + 역참조를 원자적으로 처리
    // 동일 결제로 이중 예약 방지 (FOR UPDATE + reservation_id IS NULL)
    const conn = await getConnection();
    let paymentId = null;
    let paymentStatus = 'pending';

    try {
      await conn.beginTransaction();

      // 결제 정보가 제공된 경우 결제 레코드 확인 + 잠금
      if (effectivePaymentKey && effectiveOrderId) {
        const [payments] = await conn.query(
          'SELECT id, status, reservation_id FROM payments WHERE pg_payment_key = ? AND pg_order_id = ? LIMIT 1 FOR UPDATE',
          [effectivePaymentKey, effectiveOrderId]
        );
        const payment = payments[0];
        if (!payment || payment.status !== 'SUCCESS') {
          await conn.rollback();
          conn.release();
          return res.status(400).json(
            error('PAYMENT_NOT_VERIFIED', '결제가 확인되지 않았습니다. 결제 완료 후 다시 시도해주세요.')
          );
        }
        if (payment.reservation_id) {
          await conn.rollback();
          conn.release();
          return res.status(409).json(
            error('PAYMENT_ALREADY_USED', '이 결제는 이미 다른 예약에 사용되었습니다.')
          );
        }
        paymentId = payment.id;
        paymentStatus = 'paid';
      }

      // 예약 생성
      await conn.query(
        `INSERT INTO reservations (
           id, store_id, customer_id, customer_name, customer_phone, customer_email,
           storage_id, storage_number, requested_storage_type,
           status, start_time, end_time, request_time, actual_start_time, actual_end_time,
           duration, bag_count, total_amount, message, special_requests, luggage_image_urls,
           payment_status, payment_method, payment_id, qr_code, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          reservationId,
          canonicalStoreId,
          customerId,
          customerName,
          cleanedPhone,
          effectiveEmail || null,
          null,
          null,
          effectiveStorageType,
          'pending',
          toMySQLDateTime(startTime),
          toMySQLDateTime(calculatedEndTime),
          toMySQLDateTime(new Date().toISOString()),
          null,
          null,
          duration,
          bagCount,
          totalAmount,
          message || null,
          null,
          null,
          paymentStatus,
          'card',
          paymentId,
          accessToken,
        ]
      );

      // 결제 레코드에 예약 ID 역참조 업데이트 (양방향 연결)
      if (paymentId) {
        await conn.query('UPDATE payments SET reservation_id = ? WHERE id = ?', [reservationId, paymentId]);
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // 생성된 예약 조회
    const [reservation] = await query(
      `SELECT
         id, store_id as storeId, customer_id as customerId,
         customer_name as customerName, customer_phone as phoneNumber,
         customer_email as email, status, start_time as startTime,
         end_time as endTime, duration, bag_count as bagCount,
         total_amount as totalAmount, message,
         requested_storage_type as storageType,
         payment_status as paymentStatus, qr_code as accessToken,
         created_at as createdAt
       FROM reservations WHERE id = ?`,
      [reservationId]
    );

    return res.status(201).json(
      success(
        {
          reservation,
          storeName: store.name,
        },
        '예약이 생성되었습니다'
      )
    );
  } catch (err) {
    console.error('[createGuestReservation] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 비회원 예약 목록 조회 (전화번호 기반)
 * GET /api/guest/reservations?phoneNumber=01012345678
 */
export const getGuestReservations = async (req, res) => {
  try {
    const phone = req.query.phoneNumber || req.query.customer_phone;
    const cleanedPhone = normalizePhone(phone);

    if (!cleanedPhone) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '전화번호가 필요합니다', {
          required: ['phoneNumber'],
        })
      );
    }

    const reservations = await query(
      `SELECT
         r.id, r.store_id as storeId, r.customer_name as customerName,
         r.customer_phone as phoneNumber, r.customer_email as email,
         r.status, r.start_time as startTime, r.end_time as endTime,
         r.duration, r.bag_count as bagCount, r.total_amount as totalAmount,
         r.message, r.requested_storage_type as storageType,
         r.payment_status as paymentStatus, r.created_at as createdAt,
         s.business_name as storeName, s.address as storeAddress,
         s.phone_number as storePhone,
         s.latitude as lat, s.longitude as lng
       FROM reservations r
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE r.customer_phone = ?
       ORDER BY r.created_at DESC`,
      [cleanedPhone]
    );

    return res.json(
      success({
        items: reservations || [],
        total: reservations?.length || 0,
      })
    );
  } catch (err) {
    console.error('[getGuestReservations] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 비회원 예약 단건 조회 (토큰 기반)
 * GET /api/guest/reservations/:id?token=xxx
 *
 * 토큰이 없으면 조회 불가 → 보안
 */
export const getGuestReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(401).json(error('TOKEN_REQUIRED', '예약 조회에는 토큰이 필요합니다'));
    }

    const [reservation] = await query(
      `SELECT
         r.id, r.store_id as storeId, r.customer_name as customerName,
         r.customer_phone as phoneNumber, r.customer_email as email,
         r.status, r.start_time as startTime, r.end_time as endTime,
         r.duration, r.bag_count as bagCount, r.total_amount as totalAmount,
         r.message, r.requested_storage_type as storageType,
         r.payment_status as paymentStatus, r.created_at as createdAt,
         s.business_name as storeName, s.address as storeAddress,
         s.phone_number as storePhone,
         s.latitude as lat, s.longitude as lng
       FROM reservations r
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE r.id = ?
         AND r.qr_code = ?
       LIMIT 1`,
      [id, token]
    );

    if (!reservation) {
      return res.status(404).json(error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다'));
    }

    return res.json(success(reservation));
  } catch (err) {
    console.error('[getGuestReservation] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 미결제 예약 자동 정리 (TTL)
 * POST /api/guest/reservations/cleanup
 *
 * 30분 이상 pending 상태인 예약을 cancelled로 변경
 * Cron 또는 스케줄러에서 호출
 */
export const cleanupExpiredReservations = async (req, res) => {
  try {
    const result = await query(
      `UPDATE reservations
       SET status = 'cancelled', updated_at = NOW()
       WHERE status = 'pending'
         AND payment_status = 'pending'
         AND customer_id LIKE 'guest_%'
         AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [RESERVATION_TTL_MINUTES]
    );

    const cancelledCount = result?.affectedRows || 0;

    return res.json(
      success(
        { cancelledCount, ttlMinutes: RESERVATION_TTL_MINUTES },
        `${cancelledCount}건의 만료 예약이 정리되었습니다`
      )
    );
  } catch (err) {
    console.error('[cleanupExpiredReservations] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 비회원 예약 취소
 * PUT /api/guest/reservations/:id/cancel
 * Body: { phoneNumber }
 *
 * 인증 대신 본인 휴대폰 번호 매칭으로 본인 확인.
 * 시작 시간(start_time)이 미래인 예약만 취소 가능.
 * pending/pending_approval/confirmed 상태에서만 가능.
 */
export const cancelGuestReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const phoneNumber = (req.body?.phoneNumber || req.query?.phoneNumber || '').toString();

    if (!id) {
      return res.status(400).json(error('VALIDATION_ERROR', '예약 ID가 필요합니다'));
    }
    if (!phoneNumber) {
      return res.status(400).json(error('VALIDATION_ERROR', '전화번호가 필요합니다'));
    }

    const cleanedPhone = normalizePhone(phoneNumber);

    const rows = await query(
      `SELECT id, customer_phone, status, start_time
         FROM reservations
        WHERE id = ?
        LIMIT 1`,
      [id]
    );
    const reservation = rows?.[0];
    if (!reservation) {
      return res.status(404).json(error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다'));
    }

    // 본인 확인 (전화번호 정규화 후 비교)
    if (normalizePhone(reservation.customer_phone) !== cleanedPhone) {
      return res.status(403).json(error('FORBIDDEN', '본인 예약만 취소할 수 있습니다'));
    }

    // 취소 가능 상태 체크
    const cancellable = ['pending', 'pending_approval', 'confirmed'];
    if (!cancellable.includes(reservation.status)) {
      return res.status(409).json(
        error('NOT_CANCELLABLE', '현재 상태에서는 취소할 수 없습니다', {
          currentStatus: reservation.status,
        })
      );
    }

    // 시작 시간 미래 체크
    const start = new Date(reservation.start_time);
    if (Number.isFinite(start.getTime()) && start.getTime() <= Date.now()) {
      return res.status(409).json(
        error('TOO_LATE_TO_CANCEL', '이미 시작된(또는 지난) 예약은 취소할 수 없습니다', {
          startTime: reservation.start_time,
        })
      );
    }

    await query(
      `UPDATE reservations
          SET status = 'cancelled', updated_at = NOW()
        WHERE id = ?`,
      [id]
    );

    return res.json(
      success({ id, status: 'cancelled' }, '예약이 취소되었습니다')
    );
  } catch (err) {
    console.error('[cancelGuestReservation] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 매장 시간대별 사이즈 가용 수량 조회 (모달 동적 표시용)
 * GET /api/guest/reservations/availability?storeId=&startTime=&duration=
 *
 * - 비회원 환경에서 호출되므로 인증 불요 (rate limit은 라우트 레벨)
 * - 모든 ALLOWED_STORAGE_TYPES에 대해 maxCapacity / currentCount / remaining 반환
 * - duration 미지정 시 4시간 기본
 */
export const getAvailability = async (req, res) => {
  try {
    const storeId = (req.query?.storeId || '').toString();
    const startTime = (req.query?.startTime || '').toString();
    const durationRaw = req.query?.duration;
    const duration = Number(durationRaw) || 4;

    if (!storeId) {
      return res.status(400).json(error('VALIDATION_ERROR', 'storeId가 필요합니다'));
    }
    if (!startTime) {
      return res.status(400).json(error('VALIDATION_ERROR', 'startTime이 필요합니다'));
    }

    const start = new Date(startTime);
    if (!Number.isFinite(start.getTime())) {
      return res.status(400).json(error('VALIDATION_ERROR', 'startTime 포맷이 올바르지 않습니다'));
    }

    // storeId가 slug면 canonical id로 정규화
    const resolved = await resolveStore(storeId);
    if (!resolved) {
      return res.status(404).json(error('STORE_NOT_FOUND', '매장을 찾을 수 없습니다'));
    }
    const canonicalStoreId = resolved.id;

    const endDate = new Date(start.getTime() + duration * 3600 * 1000);
    const endTimeIso = endDate.toISOString();

    const items = {};
    for (const type of ALLOWED_STORAGE_TYPES) {
      try {
        // bagCount=0으로 호출하면 (currentCount + 0) <= maxCapacity, 항상 available true.
        // 우리는 remaining 만 쓰므로 OK.
        const cap = await checkCapacity(canonicalStoreId, type, startTime, endTimeIso, 0);
        items[type] = {
          maxCapacity: cap.maxCapacity,
          currentCount: cap.currentCount,
          remaining: Math.max(0, cap.maxCapacity - cap.currentCount),
        };
      } catch (e) {
        console.warn(`[getAvailability] type=${type} 실패:`, e?.message);
        items[type] = { maxCapacity: 0, currentCount: 0, remaining: 0 };
      }
    }

    // 응답에 originalParam(클라이언트가 보낸 값) + canonical 둘 다 노출은 안 함.
    // canonical UUID 외부 노출 방지 위해 클라이언트가 보낸 storeId 그대로 echo만.
    return res.json(
      success({ storeId, startTime, endTime: endTimeIso, duration, items }, '가용 수량 조회 완료')
    );
  } catch (err) {
    console.error('[getAvailability] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};
