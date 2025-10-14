/**
 * 표준 응답 포맷터 유틸리티
 */

/**
 * 성공 응답 생성
 * @param {any} data - 응답 데이터
 * @param {string} message - 성공 메시지 (선택)
 * @returns {Object} 성공 응답 객체
 */
export const success = (data = null, message = null) => {
  const response = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return response;
};

/**
 * 에러 응답 생성
 * @param {string} code - 에러 코드
 * @param {string} message - 에러 메시지
 * @param {Object} details - 에러 상세 정보 (선택)
 * @param {number} statusCode - HTTP 상태 코드 (선택)
 * @returns {Object} 에러 응답 객체
 */
export const error = (code, message, details = null, statusCode = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    response.error.details = details;
  }

  if (statusCode) {
    response.error.statusCode = statusCode;
  }

  return response;
};

/**
 * 페이지네이션 응답 생성
 * @param {Array} items - 데이터 배열
 * @param {number} page - 현재 페이지 번호
 * @param {number} limit - 페이지당 항목 수
 * @param {number} total - 전체 항목 수
 * @returns {Object} 페이지네이션 응답 객체
 */
export const paginate = (items, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
};

/**
 * Express 미들웨어용 성공 응답 헬퍼
 * @param {Object} res - Express response 객체
 * @param {any} data - 응답 데이터
 * @param {string} message - 성공 메시지 (선택)
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 */
export const sendSuccess = (res, data = null, message = null, statusCode = 200) => {
  res.status(statusCode).json(success(data, message));
};

/**
 * Express 미들웨어용 에러 응답 헬퍼
 * @param {Object} res - Express response 객체
 * @param {string} code - 에러 코드
 * @param {string} message - 에러 메시지
 * @param {Object} details - 에러 상세 정보 (선택)
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 400)
 */
export const sendError = (res, code, message, details = null, statusCode = 400) => {
  res.status(statusCode).json(error(code, message, details, statusCode));
};
