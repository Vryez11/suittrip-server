/**
 * 예약 관리 컨트롤러
 * Phase 3 - 예약 관리 APIs
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';

/**
 * 예약 목록 조회
 * GET /api/reservations
 */
export const getReservations = async (req, res) => {
  try {
    const storeId = req.storeId;
    const {
      status: statusFilter,
      date,
      customerId,
      page = 1,
      limit = 20,
    } = req.query;

    // 필터 조건 구성
    const conditions = ['store_id = ?'];
    const params = [storeId];

    if (statusFilter) {
      conditions.push('status = ?');
      params.push(statusFilter);
    }

    if (date) {
      conditions.push('DATE(start_time) = ?');
      params.push(date);
    }

    if (customerId) {
      conditions.push('customer_id = ?');
      params.push(customerId);
    }

    const whereClause = conditions.join(' AND ');

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as total FROM reservations WHERE ${whereClause}`,
      params
    );
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // 페이지네이션 계산
    const offset = (page - 1) * limit;

    // 예약 목록 조회
    const reservations = await query(
      `SELECT
        r.id, r.store_id as storeId, r.customer_id as customerId,
        r.customer_name as customerName, r.customer_phone as customerPhone,
        r.customer_email as customerEmail,
        r.storage_id as storageId, r.storage_number as storageNumber,
        r.status, r.start_time as startTime, r.end_time as endTime,
        r.request_time as requestTime, r.actual_start_time as actualStartTime,
        r.actual_end_time as actualEndTime, r.duration,
        r.bag_count as bagCount, r.total_amount as totalAmount,
        r.message, r.special_requests as specialRequests,
        r.luggage_image_urls as luggageImageUrls,
        r.payment_status as paymentStatus, r.payment_method as paymentMethod,
        r.qr_code as qrCode, r.created_at as createdAt, r.updated_at as updatedAt
      FROM reservations r
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // 응답 데이터 구성
    const formattedReservations = reservations.map(reservation => {
      // luggage_image_urls JSON 파싱
      let luggageImageUrls = [];
      if (reservation.luggageImageUrls) {
        try {
          luggageImageUrls = typeof reservation.luggageImageUrls === 'string'
            ? JSON.parse(reservation.luggageImageUrls)
            : reservation.luggageImageUrls;
        } catch (e) {
          console.error('[getReservations] luggage_image_urls 파싱 실패:', e);
        }
      }

      return {
        id: reservation.id,
        storeId: reservation.storeId,
        customerId: reservation.customerId,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail,
        storageId: reservation.storageId,
        storageNumber: reservation.storageNumber,
        status: reservation.status,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        requestTime: reservation.requestTime,
        actualStartTime: reservation.actualStartTime,
        actualEndTime: reservation.actualEndTime,
        duration: reservation.duration,
        bagCount: reservation.bagCount,
        totalAmount: reservation.totalAmount,
        message: reservation.message,
        specialRequests: reservation.specialRequests,
        luggageImageUrls,
        paymentStatus: reservation.paymentStatus,
        paymentMethod: reservation.paymentMethod,
        qrCode: reservation.qrCode,
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
      };
    });

    return res.json(
      success(
        {
          reservations: formattedReservations,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalItems,
            itemsPerPage: Number(limit),
          },
        },
        '예약 목록 조회 성공'
      )
    );
  } catch (err) {
    console.error('예약 목록 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 예약 단일 조회
 * GET /api/reservations/:id
 */
export const getReservation = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    const reservations = await query(
      `SELECT
        r.id, r.store_id as storeId, r.customer_id as customerId,
        r.customer_name as customerName, r.customer_phone as customerPhone,
        r.customer_email as customerEmail,
        r.storage_id as storageId, r.storage_number as storageNumber,
        r.status, r.start_time as startTime, r.end_time as endTime,
        r.request_time as requestTime, r.actual_start_time as actualStartTime,
        r.actual_end_time as actualEndTime, r.duration,
        r.bag_count as bagCount, r.total_amount as totalAmount,
        r.message, r.special_requests as specialRequests,
        r.luggage_image_urls as luggageImageUrls,
        r.payment_status as paymentStatus, r.payment_method as paymentMethod,
        r.qr_code as qrCode, r.created_at as createdAt, r.updated_at as updatedAt,
        s.number as storageNumberDetail, s.type as storageType
      FROM reservations r
      LEFT JOIN storages s ON r.storage_id = s.id
      WHERE r.id = ? AND r.store_id = ?
      LIMIT 1`,
      [id, storeId]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(404).json(
        error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다')
      );
    }

    const reservation = reservations[0];

    // luggage_image_urls JSON 파싱
    let luggageImageUrls = [];
    if (reservation.luggageImageUrls) {
      try {
        luggageImageUrls = typeof reservation.luggageImageUrls === 'string'
          ? JSON.parse(reservation.luggageImageUrls)
          : reservation.luggageImageUrls;
      } catch (e) {
        console.error('[getReservation] luggage_image_urls 파싱 실패:', e);
      }
    }

    const result = {
      id: reservation.id,
      storeId: reservation.storeId,
      customerId: reservation.customerId,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      storageId: reservation.storageId,
      storageNumber: reservation.storageNumberDetail || reservation.storageNumber,
      storageType: reservation.storageType,
      status: reservation.status,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      requestTime: reservation.requestTime,
      actualStartTime: reservation.actualStartTime,
      actualEndTime: reservation.actualEndTime,
      duration: reservation.duration,
      bagCount: reservation.bagCount,
      totalAmount: reservation.totalAmount,
      message: reservation.message,
      specialRequests: reservation.specialRequests,
      luggageImageUrls,
      paymentStatus: reservation.paymentStatus,
      paymentMethod: reservation.paymentMethod,
      qrCode: reservation.qrCode,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };

    return res.json(success(result, '예약 조회 성공'));
  } catch (err) {
    console.error('예약 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 예약 승인
 * PUT /api/reservations/:id/approve
 */
export const approveReservation = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;
    const { storageId, storageNumber } = req.body;

    // 예약 존재 및 상태 확인
    const reservations = await query(
      'SELECT status FROM reservations WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(404).json(
        error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다')
      );
    }

    if (reservations[0].status !== 'pending') {
      return res.status(400).json(
        error('INVALID_STATUS', '승인 가능한 상태가 아닙니다', {
          currentStatus: reservations[0].status,
        })
      );
    }

    // 보관함이 지정된 경우 상태 확인 및 업데이트
    if (storageId) {
      const storages = await query(
        'SELECT status FROM storages WHERE id = ? AND store_id = ? LIMIT 1',
        [storageId, storeId]
      );

      if (!storages || storages.length === 0) {
        return res.status(404).json(
          error('STORAGE_NOT_FOUND', '보관함을 찾을 수 없습니다')
        );
      }

      if (storages[0].status !== 'available') {
        return res.status(400).json(
          error('STORAGE_NOT_AVAILABLE', '사용 가능한 보관함이 아닙니다', {
            currentStatus: storages[0].status,
          })
        );
      }

      // 보관함 상태를 occupied로 변경
      await query(
        'UPDATE storages SET status = \'occupied\', updated_at = NOW() WHERE id = ? AND store_id = ?',
        [storageId, storeId]
      );
    }

    // 예약 상태를 confirmed로 변경
    await query(
      `UPDATE reservations
       SET status = 'confirmed', storage_id = ?, storage_number = ?, updated_at = NOW()
       WHERE id = ? AND store_id = ?`,
      [storageId || null, storageNumber || null, id, storeId]
    );

    // 업데이트된 예약 조회
    const updatedReservations = await query(
      `SELECT
        id, store_id as storeId, customer_name as customerName,
        status, storage_id as storageId, storage_number as storageNumber,
        start_time as startTime, end_time as endTime, updated_at as updatedAt
      FROM reservations
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(success(updatedReservations[0], '예약 승인 성공'));
  } catch (err) {
    console.error('예약 승인 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 예약 거부
 * PUT /api/reservations/:id/reject
 */
export const rejectReservation = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;
    const { reason } = req.body;

    // 예약 존재 및 상태 확인
    const reservations = await query(
      'SELECT status FROM reservations WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(404).json(
        error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다')
      );
    }

    if (reservations[0].status !== 'pending') {
      return res.status(400).json(
        error('INVALID_STATUS', '거부 가능한 상태가 아닙니다', {
          currentStatus: reservations[0].status,
        })
      );
    }

    // 예약 상태를 rejected로 변경
    await query(
      `UPDATE reservations
       SET status = 'rejected', message = ?, updated_at = NOW()
       WHERE id = ? AND store_id = ?`,
      [reason || '점포 사정으로 예약이 거부되었습니다', id, storeId]
    );

    // 업데이트된 예약 조회
    const updatedReservations = await query(
      `SELECT
        id, store_id as storeId, customer_name as customerName,
        status, message, updated_at as updatedAt
      FROM reservations
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(success(updatedReservations[0], '예약 거부 성공'));
  } catch (err) {
    console.error('예약 거부 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 예약 취소
 * PUT /api/reservations/:id/cancel
 */
export const cancelReservation = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    // 예약 존재 및 상태 확인
    const reservations = await query(
      'SELECT status, storage_id FROM reservations WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(404).json(
        error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다')
      );
    }

    const reservation = reservations[0];

    if (reservation.status === 'cancelled') {
      return res.status(400).json(
        error('ALREADY_CANCELLED', '이미 취소된 예약입니다')
      );
    }

    if (reservation.status === 'completed') {
      return res.status(400).json(
        error('CANNOT_CANCEL_COMPLETED', '완료된 예약은 취소할 수 없습니다')
      );
    }

    // 보관함이 할당된 경우 상태를 available로 변경
    if (reservation.storage_id) {
      await query(
        'UPDATE storages SET status = \'available\', updated_at = NOW() WHERE id = ? AND store_id = ?',
        [reservation.storage_id, storeId]
      );
    }

    // 예약 상태를 cancelled로 변경
    await query(
      'UPDATE reservations SET status = \'cancelled\', updated_at = NOW() WHERE id = ? AND store_id = ?',
      [id, storeId]
    );

    // 업데이트된 예약 조회
    const updatedReservations = await query(
      `SELECT
        id, store_id as storeId, customer_name as customerName,
        status, updated_at as updatedAt
      FROM reservations
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(success(updatedReservations[0], '예약 취소 성공'));
  } catch (err) {
    console.error('예약 취소 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 예약 상태 변경
 * PUT /api/reservations/:id/status
 */
export const updateReservationStatus = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;
    const { status: newStatus } = req.body;

    // 상태값 검증
    const validStatuses = ['pending', 'confirmed', 'rejected', 'in_progress', 'completed', 'cancelled'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '유효한 상태값이 필요합니다', {
          validStatuses,
        })
      );
    }

    // 예약 존재 확인
    const reservations = await query(
      'SELECT status, storage_id FROM reservations WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(404).json(
        error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다')
      );
    }

    const currentStatus = reservations[0].status;
    const storageId = reservations[0].storage_id;

    // 상태 전환 로직 처리
    if (newStatus === 'in_progress' && currentStatus === 'confirmed') {
      // 예약 시작 - actual_start_time 설정
      await query(
        'UPDATE reservations SET status = ?, actual_start_time = NOW(), updated_at = NOW() WHERE id = ? AND store_id = ?',
        [newStatus, id, storeId]
      );
    } else if (newStatus === 'completed' && (currentStatus === 'in_progress' || currentStatus === 'confirmed')) {
      // 예약 완료 - actual_end_time 설정, 보관함 상태를 available로 변경
      await query(
        'UPDATE reservations SET status = ?, actual_end_time = NOW(), updated_at = NOW() WHERE id = ? AND store_id = ?',
        [newStatus, id, storeId]
      );

      if (storageId) {
        await query(
          'UPDATE storages SET status = \'available\', updated_at = NOW() WHERE id = ? AND store_id = ?',
          [storageId, storeId]
        );
      }
    } else {
      // 일반적인 상태 변경
      await query(
        'UPDATE reservations SET status = ?, updated_at = NOW() WHERE id = ? AND store_id = ?',
        [newStatus, id, storeId]
      );
    }

    // 업데이트된 예약 조회
    const updatedReservations = await query(
      `SELECT
        id, store_id as storeId, customer_name as customerName,
        status, actual_start_time as actualStartTime,
        actual_end_time as actualEndTime, updated_at as updatedAt
      FROM reservations
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(success(updatedReservations[0], '예약 상태 변경 성공'));
  } catch (err) {
    console.error('예약 상태 변경 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};
