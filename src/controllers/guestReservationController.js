/**
 * Guest Reservation Controller
 * 비회원(웹) 예약 생성/조회 — 인증 불요
 * 기존 createReservation 로직을 재사용하되, 비회원 전용 검증 추가
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_STORAGE_TYPES = ['s', 'm', 'l', 'xl', 'special', 'refrigeration'];
const PRICE_PER_BAG_PER_DAY = 6000;

const toMySQLDateTime = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  return d.toISOString().slice(0, 19).replace('T', ' ');
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
      locale,
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

    // 짐 개수 검증
    if (bagCount < 1 || bagCount > 10) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '짐 개수는 1~10개 사이여야 합니다')
      );
    }

    // 전화번호 기본 검증
    const cleanedPhone = phoneNumber.replace(/[-\s]/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '올바른 전화번호를 입력해주세요')
      );
    }

    // 매장 존재 여부 확인
    const [store] = await query('SELECT id, name, status FROM stores WHERE id = ? LIMIT 1', [storeId]);
    if (!store) {
      return res.status(404).json(error('STORE_NOT_FOUND', '매장을 찾을 수 없습니다'));
    }
    if (store.status !== 'active') {
      return res.status(400).json(error('STORE_UNAVAILABLE', '현재 예약을 받지 않는 매장입니다'));
    }

    // 금액 계산 (일당 6,000원 고정)
    const totalAmount = PRICE_PER_BAG_PER_DAY * bagCount;

    // endTime 계산
    let calculatedEndTime = endTime;
    if (!calculatedEndTime && startTime && duration) {
      const start = new Date(startTime);
      start.setHours(start.getHours() + Number(duration));
      calculatedEndTime = start.toISOString();
    }

    // 비회원 고유 ID 생성
    const customerId = `guest_${cleanedPhone}_${Date.now()}`;
    const reservationId = `res_${uuidv4()}`;

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
        null,
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
         payment_status as paymentStatus, created_at as createdAt
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
 * 비회원 예약 조회 (전화번호 기반)
 * GET /api/guest/reservations?phone=010-1234-5678
 */
export const getGuestReservations = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json(error('VALIDATION_ERROR', '전화번호가 필요합니다'));
    }

    const cleanedPhone = phone.replace(/[-\s]/g, '');

    const rows = await query(
      `SELECT
         r.id, r.store_id as storeId, r.customer_name as customerName,
         r.customer_phone as phoneNumber, r.customer_email as email,
         r.status, r.start_time as startTime, r.end_time as endTime,
         r.duration, r.bag_count as bagCount, r.total_amount as totalAmount,
         r.message, r.requested_storage_type as storageType,
         r.payment_status as paymentStatus, r.created_at as createdAt,
         s.name as storeName, s.address as storeAddress, s.phone as storePhone
       FROM reservations r
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE r.customer_phone = ?
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [cleanedPhone]
    );

    return res.json(success({ reservations: rows }));
  } catch (err) {
    console.error('[getGuestReservations] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * 비회원 예약 단건 조회
 * GET /api/guest/reservations/:id
 */
export const getGuestReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const [reservation] = await query(
      `SELECT
         r.id, r.store_id as storeId, r.customer_name as customerName,
         r.customer_phone as phoneNumber, r.customer_email as email,
         r.status, r.start_time as startTime, r.end_time as endTime,
         r.duration, r.bag_count as bagCount, r.total_amount as totalAmount,
         r.message, r.requested_storage_type as storageType,
         r.payment_status as paymentStatus, r.created_at as createdAt,
         s.name as storeName, s.address as storeAddress, s.phone as storePhone,
         s.lat, s.lng
       FROM reservations r
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE r.id = ?
       LIMIT 1`,
      [id]
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
