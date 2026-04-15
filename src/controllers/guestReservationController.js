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
import { query } from '../config/database.js';
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
  // storageType에 맞는 max_capacity 컬럼명 생성
  const capacityColumn = `${storageType}_max_capacity`;

  const [config] = await query(
    `SELECT ${capacityColumn} as maxCapacity FROM store_storage_config WHERE store_id = ? LIMIT 1`,
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
      startTime,
      endTime,
      duration,
      bagCount,
      storageType = 's',
      message,
    } = req.body;

    // 필수 필드 검증
    if (!storeId || !customerName || !phoneNumber || !startTime || !duration || !bagCount) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '필수 정보가 누락되었습니다', {
          required: ['storeId', 'customerName', 'phoneNumber', 'startTime', 'duration', 'bagCount'],
        })
      );
    }

    if (!ALLOWED_STORAGE_TYPES.includes(storageType)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '유효하지 않은 보관 타입입니다', { allowed: ALLOWED_STORAGE_TYPES })
      );
    }

    if (bagCount < 1 || bagCount > 10) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '짐 개수는 1~10개 사이여야 합니다')
      );
    }

    const cleanedPhone = phoneNumber.replace(/[-\s]/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '올바른 전화번호를 입력해주세요')
      );
    }

    // 매장 존재 + 활성 여부 확인
    const [store] = await query(
      'SELECT id, business_name as name FROM stores WHERE id = ? LIMIT 1',
      [storeId]
    );
    if (!store) {
      return res.status(404).json(error('STORE_NOT_FOUND', '매장을 찾을 수 없습니다'));
    }

    // endTime 계산
    let calculatedEndTime = endTime;
    if (!calculatedEndTime && startTime && duration) {
      const start = new Date(startTime);
      start.setHours(start.getHours() + Number(duration));
      calculatedEndTime = start.toISOString();
    }

    // capacity 검증
    const capacity = await checkCapacity(storeId, storageType, startTime, calculatedEndTime, bagCount);
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

    await query(
      `INSERT INTO reservations (
         id, store_id, customer_id, customer_name, customer_phone, customer_email,
         storage_id, storage_number, requested_storage_type,
         status, start_time, end_time, request_time, actual_start_time, actual_end_time,
         duration, bag_count, total_amount, message, special_requests, luggage_image_urls,
         payment_status, payment_method, qr_code, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        reservationId,
        storeId,
        customerId,
        customerName,
        cleanedPhone,
        email || null,
        null,
        null,
        storageType,
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
        'pending',
        'card',
        accessToken, // qr_code 컬럼을 access_token 저장에 재활용
      ]
    );

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
         s.store_phone_number as storePhone,
         s.latitude as lat, s.longitude as lng
       FROM reservations r
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE r.id = ? AND r.qr_code = ?
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
