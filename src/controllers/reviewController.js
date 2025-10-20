/**
 * 리뷰 컨트롤러
 * Phase 4 - 리뷰 관리 APIs
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';

/**
 * 리뷰 목록 조회
 * GET /api/reviews
 */
export const getReviews = async (req, res) => {
  try {
    const storeId = req.storeId;
    const {
      rating,
      status,
      type,
      page = 1,
      limit = 20,
    } = req.query;

    // 필터 조건 구성
    const conditions = ['store_id = ?'];
    const params = [storeId];

    if (rating) {
      conditions.push('rating = ?');
      params.push(Number(rating));
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as total FROM reviews WHERE ${whereClause}`,
      params
    );
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // 페이지네이션 계산
    const offset = (page - 1) * limit;

    // 리뷰 목록 조회
    const reviews = await query(
      `SELECT
        id, store_id as storeId, customer_id as customerId,
        customer_name as customerName, reservation_id as reservationId,
        storage_id as storageId, storage_number as storageNumber,
        type, rating, comment, images, status,
        response, response_date as responseDate,
        created_at as createdAt, updated_at as updatedAt
      FROM reviews
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // 응답 데이터 구성 - Flutter ReviewItem 모델에 맞춤
    const formattedReviews = reviews.map(review => {
      // images JSON 파싱
      let images = [];
      if (review.images) {
        try {
          images = typeof review.images === 'string'
            ? JSON.parse(review.images)
            : review.images;
        } catch (e) {
          console.error('[getReviews] images 파싱 실패:', e);
        }
      }

      // isResponded: response가 있으면 true
      const isResponded = review.response !== null && review.response !== undefined && review.response.trim() !== '';

      return {
        id: review.id,
        customerId: review.customerId,
        customerName: review.customerName,
        storeId: review.storeId,
        reservationId: review.reservationId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        isResponded,
        response: review.response || null,
        respondedAt: review.responseDate || null,
        type: review.type || 'storage', // Flutter ReviewType: storage, store
      };
    });

    // 평균 평점 및 통계
    const statsResult = await query(
      `SELECT
        COALESCE(AVG(rating), 0) as averageRating,
        COUNT(*) as totalReviews,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as fiveStars,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as fourStars,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as threeStars,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as twoStars,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as oneStar,
        SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as respondedCount
      FROM reviews
      WHERE store_id = ?`,
      [storeId]
    );

    const stats = statsResult[0];

    return res.json(
      success(
        {
          reviews: formattedReviews,
          statistics: {
            averageRating: Number(stats.averageRating.toFixed(1)),
            totalReviews: Number(stats.totalReviews),
            ratingDistribution: {
              5: Number(stats.fiveStars),
              4: Number(stats.fourStars),
              3: Number(stats.threeStars),
              2: Number(stats.twoStars),
              1: Number(stats.oneStar),
            },
            responseRate: stats.totalReviews > 0
              ? Number(((stats.respondedCount / stats.totalReviews) * 100).toFixed(1))
              : 0,
          },
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalItems,
            itemsPerPage: Number(limit),
          },
        },
        '리뷰 목록 조회 성공'
      )
    );
  } catch (err) {
    console.error('리뷰 목록 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 리뷰 단일 조회
 * GET /api/reviews/:id
 */
export const getReview = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    const reviews = await query(
      `SELECT
        id, store_id as storeId, customer_id as customerId,
        customer_name as customerName, reservation_id as reservationId,
        storage_id as storageId, storage_number as storageNumber,
        type, rating, comment, images, status,
        response, response_date as responseDate,
        created_at as createdAt, updated_at as updatedAt
      FROM reviews
      WHERE id = ? AND store_id = ?
      LIMIT 1`,
      [id, storeId]
    );

    if (!reviews || reviews.length === 0) {
      return res.status(404).json(
        error('REVIEW_NOT_FOUND', '리뷰를 찾을 수 없습니다')
      );
    }

    const review = reviews[0];

    // images JSON 파싱
    let images = [];
    if (review.images) {
      try {
        images = typeof review.images === 'string'
          ? JSON.parse(review.images)
          : review.images;
      } catch (e) {
        console.error('[getReview] images 파싱 실패:', e);
      }
    }

    // isResponded: response가 있으면 true
    const isResponded = review.response !== null && review.response !== undefined && review.response.trim() !== '';

    // Flutter ReviewItem 모델에 맞춘 응답 구조
    const result = {
      id: review.id,
      customerId: review.customerId,
      customerName: review.customerName,
      storeId: review.storeId,
      reservationId: review.reservationId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      isResponded,
      response: review.response || null,
      respondedAt: review.responseDate || null,
      type: review.type || 'storage',
    };

    return res.json(success(result, '리뷰 조회 성공'));
  } catch (err) {
    console.error('리뷰 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 리뷰 답글 작성
 * POST /api/reviews/:id/response
 */
export const createReviewResponse = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;
    const { response: responseText } = req.body;

    // 답글 검증
    if (!responseText || responseText.trim().length === 0) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '답글 내용이 필요합니다', {
          field: 'response',
        })
      );
    }

    // 리뷰 존재 확인
    const reviews = await query(
      'SELECT id, status FROM reviews WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reviews || reviews.length === 0) {
      return res.status(404).json(
        error('REVIEW_NOT_FOUND', '리뷰를 찾을 수 없습니다')
      );
    }

    // 리뷰 답글 저장
    await query(
      `UPDATE reviews
       SET response = ?, response_date = NOW(), status = 'responded', updated_at = NOW()
       WHERE id = ? AND store_id = ?`,
      [responseText, id, storeId]
    );

    // 업데이트된 리뷰 조회
    const updatedReviews = await query(
      `SELECT
        id, response, response_date as responseDate, status, updated_at as updatedAt
      FROM reviews
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(
      success(
        {
          id: updatedReviews[0].id,
          response: updatedReviews[0].response,
          responseDate: updatedReviews[0].responseDate,
          status: updatedReviews[0].status,
          updatedAt: updatedReviews[0].updatedAt,
        },
        '리뷰 답글 작성 성공'
      )
    );
  } catch (err) {
    console.error('리뷰 답글 작성 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 리뷰 답글 수정
 * PUT /api/reviews/:id/response
 */
export const updateReviewResponse = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;
    const { response: responseText } = req.body;

    // 답글 검증
    if (!responseText || responseText.trim().length === 0) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '답글 내용이 필요합니다', {
          field: 'response',
        })
      );
    }

    // 리뷰 존재 확인
    const reviews = await query(
      'SELECT id, response FROM reviews WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reviews || reviews.length === 0) {
      return res.status(404).json(
        error('REVIEW_NOT_FOUND', '리뷰를 찾을 수 없습니다')
      );
    }

    if (!reviews[0].response) {
      return res.status(400).json(
        error('RESPONSE_NOT_FOUND', '답글이 존재하지 않습니다')
      );
    }

    // 리뷰 답글 수정
    await query(
      `UPDATE reviews
       SET response = ?, updated_at = NOW()
       WHERE id = ? AND store_id = ?`,
      [responseText, id, storeId]
    );

    // 업데이트된 리뷰 조회
    const updatedReviews = await query(
      `SELECT
        id, response, updated_at as updatedAt
      FROM reviews
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(
      success(
        {
          id: updatedReviews[0].id,
          response: updatedReviews[0].response,
          updatedAt: updatedReviews[0].updatedAt,
        },
        '리뷰 답글 수정 성공'
      )
    );
  } catch (err) {
    console.error('리뷰 답글 수정 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 리뷰 답글 삭제
 * DELETE /api/reviews/:id/response
 */
export const deleteReviewResponse = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    // 리뷰 존재 확인
    const reviews = await query(
      'SELECT id, response FROM reviews WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!reviews || reviews.length === 0) {
      return res.status(404).json(
        error('REVIEW_NOT_FOUND', '리뷰를 찾을 수 없습니다')
      );
    }

    if (!reviews[0].response) {
      return res.status(400).json(
        error('RESPONSE_NOT_FOUND', '답글이 존재하지 않습니다')
      );
    }

    // 리뷰 답글 삭제
    await query(
      `UPDATE reviews
       SET response = NULL, response_date = NULL, status = 'pending', updated_at = NOW()
       WHERE id = ? AND store_id = ?`,
      [id, storeId]
    );

    return res.json(
      success(
        {
          id,
          deleted: true,
        },
        '리뷰 답글 삭제 성공'
      )
    );
  } catch (err) {
    console.error('리뷰 답글 삭제 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};
