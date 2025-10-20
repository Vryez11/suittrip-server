/**
 * 체크인/보관 중인 짐 관리 컨트롤러
 * Flutter StorageItem 모델과 매핑
 * StorageItem = 현재 보관 중인 짐 (active/in_progress 상태의 예약)
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';

/**
 * 현재 보관 중인 짐 목록 조회
 * Flutter StorageItem 모델과 매핑
 * GET /api/checkins
 */
export const getCheckins = async (req, res) => {
  try {
    const storeId = req.storeId;
    const {
      status: statusFilter,
      page = 1,
      limit = 20,
    } = req.query;

    // 필터 조건 구성 - 보관 중인 예약만 (confirmed 또는 in_progress)
    const conditions = ['r.store_id = ?', '(r.status = "confirmed" OR r.status = "in_progress")'];
    const params = [storeId];

    const whereClause = conditions.join(' AND ');

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as total FROM reservations r WHERE ${whereClause}`,
      params
    );
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // 페이지네이션 계산
    const offset = (page - 1) * limit;

    // 보관 중인 짐 목록 조회
    const checkins = await query(
      `SELECT
        r.id,
        r.customer_name as customerName,
        r.customer_phone as phoneNumber,
        r.actual_start_time as checkInTime,
        r.duration,
        r.storage_number as slotNumber,
        r.bag_count as bagCount,
        r.total_amount as price,
        r.message as description,
        r.special_requests as specialRequests,
        r.luggage_image_urls as luggageImageUrls,
        r.status,
        r.start_time as startTime,
        r.end_time as endTime,
        r.created_at as createdAt,
        r.updated_at as updatedAt
      FROM reservations r
      WHERE ${whereClause}
      ORDER BY r.actual_start_time DESC, r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // 응답 데이터 구성 - Flutter StorageItem 형식에 맞춤
    const formattedCheckins = checkins.map(checkin => {
      // luggage_image_urls JSON 파싱
      let luggageImageUrls = [];
      if (checkin.luggageImageUrls) {
        try {
          luggageImageUrls = typeof checkin.luggageImageUrls === 'string'
            ? JSON.parse(checkin.luggageImageUrls)
            : checkin.luggageImageUrls;
        } catch (e) {
          console.error('[getCheckins] luggage_image_urls 파싱 실패:', e);
        }
      }

      // checkInTime 결정 (actual_start_time 우선, 없으면 start_time 사용)
      const checkInTime = checkin.checkInTime || checkin.startTime;

      // 상태 계산 (active, expiring, overdue)
      const now = new Date();
      const endTime = new Date(checkin.endTime);
      const timeRemaining = endTime - now;
      const hoursRemaining = timeRemaining / (1000 * 60 * 60);

      let storageStatus = 'active';
      if (timeRemaining < 0) {
        storageStatus = 'overdue'; // 연체
      } else if (hoursRemaining <= 2) {
        storageStatus = 'expiring'; // 만료 임박 (2시간 이내)
      }

      // specialRequests에서 냉장보관 여부 확인
      const requiresRefrigeration = checkin.specialRequests
        ? checkin.specialRequests.includes('냉장') || checkin.specialRequests.includes('refrigerat')
        : false;

      return {
        id: checkin.id,
        customerName: checkin.customerName,
        phoneNumber: checkin.phoneNumber,
        checkInTime: checkInTime,
        duration: checkin.duration,
        slotNumber: checkin.slotNumber || 'N/A',
        bagCount: checkin.bagCount,
        price: checkin.price,
        description: checkin.description || '',
        requiresRefrigeration,
        luggageImageUrls,
        status: storageStatus, // Flutter StorageStatus: active, expiring, overdue
      };
    });

    return res.json(
      success(
        {
          items: formattedCheckins, // Flutter에서 사용하는 필드명
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalItems,
            itemsPerPage: Number(limit),
          },
        },
        '보관 중인 짐 목록 조회 성공'
      )
    );
  } catch (err) {
    console.error('보관 중인 짐 목록 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 보관 중인 짐 단일 조회
 * Flutter StorageItem 모델과 매핑
 * GET /api/checkins/:id
 */
export const getCheckin = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    const checkins = await query(
      `SELECT
        r.id,
        r.customer_name as customerName,
        r.customer_phone as phoneNumber,
        r.actual_start_time as checkInTime,
        r.duration,
        r.storage_number as slotNumber,
        r.bag_count as bagCount,
        r.total_amount as price,
        r.message as description,
        r.special_requests as specialRequests,
        r.luggage_image_urls as luggageImageUrls,
        r.status,
        r.start_time as startTime,
        r.end_time as endTime,
        r.created_at as createdAt,
        r.updated_at as updatedAt
      FROM reservations r
      WHERE r.id = ? AND r.store_id = ?
      LIMIT 1`,
      [id, storeId]
    );

    if (!checkins || checkins.length === 0) {
      return res.status(404).json(
        error('CHECKIN_NOT_FOUND', '보관 중인 짐을 찾을 수 없습니다')
      );
    }

    const checkin = checkins[0];

    // luggage_image_urls JSON 파싱
    let luggageImageUrls = [];
    if (checkin.luggageImageUrls) {
      try {
        luggageImageUrls = typeof checkin.luggageImageUrls === 'string'
          ? JSON.parse(checkin.luggageImageUrls)
          : checkin.luggageImageUrls;
      } catch (e) {
        console.error('[getCheckin] luggage_image_urls 파싱 실패:', e);
      }
    }

    // checkInTime 결정
    const checkInTime = checkin.checkInTime || checkin.startTime;

    // 상태 계산
    const now = new Date();
    const endTime = new Date(checkin.endTime);
    const timeRemaining = endTime - now;
    const hoursRemaining = timeRemaining / (1000 * 60 * 60);

    let storageStatus = 'active';
    if (timeRemaining < 0) {
      storageStatus = 'overdue';
    } else if (hoursRemaining <= 2) {
      storageStatus = 'expiring';
    }

    // specialRequests에서 냉장보관 여부 확인
    const requiresRefrigeration = checkin.specialRequests
      ? checkin.specialRequests.includes('냉장') || checkin.specialRequests.includes('refrigerat')
      : false;

    const result = {
      id: checkin.id,
      customerName: checkin.customerName,
      phoneNumber: checkin.phoneNumber,
      checkInTime: checkInTime,
      duration: checkin.duration,
      slotNumber: checkin.slotNumber || 'N/A',
      bagCount: checkin.bagCount,
      price: checkin.price,
      description: checkin.description || '',
      requiresRefrigeration,
      luggageImageUrls,
      status: storageStatus,
    };

    return res.json(success(result, '보관 중인 짐 조회 성공'));
  } catch (err) {
    console.error('보관 중인 짐 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 짐 체크아웃 (픽업 완료)
 * PUT /api/checkins/:id/checkout
 */
export const checkoutItem = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    // 예약 존재 확인
    const reservations = await query(
      'SELECT status, storage_id FROM reservations WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reservations || reservations.length === 0) {
      return res.status(404).json(
        error('CHECKIN_NOT_FOUND', '보관 중인 짐을 찾을 수 없습니다')
      );
    }

    const reservation = reservations[0];

    // 체크아웃 가능 상태 확인
    if (reservation.status !== 'confirmed' && reservation.status !== 'in_progress') {
      return res.status(400).json(
        error('INVALID_STATUS', '체크아웃 가능한 상태가 아닙니다', {
          currentStatus: reservation.status,
        })
      );
    }

    // 예약을 완료 상태로 변경
    await query(
      'UPDATE reservations SET status = "completed", actual_end_time = NOW(), updated_at = NOW() WHERE id = ? AND store_id = ?',
      [id, storeId]
    );

    // 보관함이 할당된 경우 상태를 available로 변경
    if (reservation.storage_id) {
      await query(
        'UPDATE storages SET status = "available", updated_at = NOW() WHERE id = ? AND store_id = ?',
        [reservation.storage_id, storeId]
      );
    }

    return res.json(
      success(
        {
          id,
          status: 'completed',
          checkoutTime: new Date().toISOString(),
        },
        '체크아웃 성공'
      )
    );
  } catch (err) {
    console.error('체크아웃 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};