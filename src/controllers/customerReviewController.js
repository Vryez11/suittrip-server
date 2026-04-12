/**
 * 고객용 리뷰 CRUD 컨트롤러
 * 고객이 리뷰를 작성/조회/수정/삭제
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';

/**
 * 리뷰 작성
 * POST /api/customer/reviews
 */
export const createReview = async (req, res) => {
  try {
    const customerId = req.customerId;
    const {
      storeId,
      reservationId,
      storageId,
      storageNumber,
      type = 'storage',
      rating,
      comment,
      images,
    } = req.body;

    if (!storeId || !rating || !comment) {
      return res.status(400).json(
        error('VALIDATION_ERROR', 'storeId, rating, comment이 필요합니다', {
          required: ['storeId', 'rating', 'comment'],
        })
      );
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json(error('VALIDATION_ERROR', 'rating은 1~5 사이여야 합니다'));
    }

    if (!['storage', 'store'].includes(type)) {
      return res.status(400).json(error('VALIDATION_ERROR', 'type은 storage 또는 store여야 합니다'));
    }

    // 동일 예약에 대한 중복 리뷰 방지
    if (reservationId) {
      const existing = await query(
        'SELECT id FROM reviews WHERE reservation_id = ? AND customer_id = ? AND type = ? LIMIT 1',
        [reservationId, customerId, type]
      );
      if (existing && existing.length > 0) {
        return res.status(409).json(error('DUPLICATE_REVIEW', '이미 해당 예약에 대한 리뷰가 있습니다'));
      }
    }

    // 고객 이름 조회
    const customerRows = await query('SELECT name FROM customers WHERE id = ? LIMIT 1', [customerId]);
    const customerName = customerRows?.[0]?.name || '사용자';

    const reviewId = `rev_${uuidv4()}`;
    await query(
      `INSERT INTO reviews (id, store_id, customer_id, customer_name, reservation_id, storage_id, storage_number,
         type, rating, comment, images, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        reviewId,
        storeId,
        customerId,
        customerName,
        reservationId || null,
        storageId || null,
        storageNumber || null,
        type,
        rating,
        comment,
        images ? JSON.stringify(images) : null,
      ]
    );

    const [row] = await query(
      `SELECT id, store_id as storeId, customer_id as customerId, customer_name as customerName,
              reservation_id as reservationId, type, rating, comment, images, status,
              created_at as createdAt
       FROM reviews WHERE id = ?`,
      [reviewId]
    );

    // images JSON 파싱
    if (row.images && typeof row.images === 'string') {
      try { row.images = JSON.parse(row.images); } catch { row.images = []; }
    }

    return res.status(201).json(success(row, '리뷰가 작성되었습니다'));
  } catch (err) {
    console.error('[createReview] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 내 리뷰 목록 조회
 * GET /api/customer/reviews/my
 */
export const getMyReviews = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { type, page = 1, limit = 20 } = req.query;

    const conditions = ['r.customer_id = ?'];
    const params = [customerId];

    if (type) {
      conditions.push('r.type = ?');
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    // 전체 개수
    const countResult = await query(
      `SELECT COUNT(*) as total FROM reviews r WHERE ${whereClause}`,
      params
    );
    const totalItems = countResult[0]?.total || 0;

    // 리뷰 목록 + 매장 정보 JOIN
    const rows = await query(
      `SELECT
         r.id, r.store_id as storeId, r.customer_id as customerId, r.customer_name as customerName,
         r.reservation_id as reservationId, r.storage_id as storageId, r.storage_number as storageNumber,
         r.type, r.rating, r.comment, r.images, r.status,
         r.response, r.response_date as responseDate,
         r.created_at as createdAt, r.updated_at as updatedAt,
         s.business_name as storeName, s.address as storeAddress
       FROM reviews r
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // images JSON 파싱
    const reviews = rows.map((row) => {
      if (row.images && typeof row.images === 'string') {
        try { row.images = JSON.parse(row.images); } catch { row.images = []; }
      }
      return {
        ...row,
        isResponded: row.status === 'responded',
        store: row.storeName ? { id: row.storeId, businessName: row.storeName, address: row.storeAddress } : null,
      };
    });

    return res.json(
      success({
        items: reviews,
        page: Number(page),
        limit: Number(limit),
        total: totalItems,
      })
    );
  } catch (err) {
    console.error('[getMyReviews] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 리뷰 수정
 * PATCH /api/customer/reviews/:id
 */
export const updateReview = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { id } = req.params;
    const { rating, comment, images } = req.body;

    // 본인 리뷰인지 확인
    const existing = await query(
      'SELECT id, status FROM reviews WHERE id = ? AND customer_id = ? LIMIT 1',
      [id, customerId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json(error('NOT_FOUND', '리뷰를 찾을 수 없습니다'));
    }

    const setClauses = [];
    const updateParams = [];
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json(error('VALIDATION_ERROR', 'rating은 1~5 사이여야 합니다'));
      }
      setClauses.push('rating = ?');
      updateParams.push(rating);
    }
    if (comment !== undefined) {
      setClauses.push('comment = ?');
      updateParams.push(comment);
    }
    if (images !== undefined) {
      setClauses.push('images = ?');
      updateParams.push(JSON.stringify(images));
    }

    if (setClauses.length === 0) {
      return res.status(400).json(error('VALIDATION_ERROR', '변경할 필드가 필요합니다'));
    }

    setClauses.push('updated_at = NOW()');
    updateParams.push(id, customerId);

    await query(
      `UPDATE reviews SET ${setClauses.join(', ')} WHERE id = ? AND customer_id = ?`,
      updateParams
    );

    return res.json(success({ id, updated: true }, '리뷰가 수정되었습니다'));
  } catch (err) {
    console.error('[updateReview] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 리뷰 삭제
 * DELETE /api/customer/reviews/:id
 */
export const deleteReview = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM reviews WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(error('NOT_FOUND', '리뷰를 찾을 수 없습니다'));
    }

    return res.json(success({ id, deleted: true }, '리뷰가 삭제되었습니다'));
  } catch (err) {
    console.error('[deleteReview] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};
