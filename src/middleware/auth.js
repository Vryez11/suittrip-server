/**
 * JWT 인증 미들웨어
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { error } from '../utils/response.js';

/**
 * JWT 토큰 검증 미들웨어
 *
 * Authorization 헤더에서 Bearer 토큰을 추출하고 검증합니다.
 * 검증 성공 시 req.storeId와 req.email을 설정합니다.
 */
export const authenticate = async (req, res, next) => {
  try {
    // Authorization 헤더 확인
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json(
        error('AUTHENTICATION_REQUIRED', '인증이 필요합니다', {
          message: 'Authorization 헤더가 없습니다',
        })
      );
    }

    // Bearer 토큰 추출
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json(
        error('INVALID_TOKEN_FORMAT', '잘못된 토큰 형식입니다', {
          message: 'Authorization 헤더는 "Bearer {token}" 형식이어야 합니다',
        })
      );
    }

    const token = parts[1];

    // 토큰 검증
    const verifyResult = verifyAccessToken(token);

    if (!verifyResult.valid) {
      return res.status(401).json(
        error('TOKEN_INVALID', '유효하지 않은 토큰입니다', {
          message: verifyResult.error,
        })
      );
    }

    // 페이로드에서 정보 추출
    const { storeId, email } = verifyResult.payload;

    if (!storeId) {
      return res.status(401).json(
        error('TOKEN_INVALID', '토큰에 점포 ID가 없습니다')
      );
    }

    // req 객체에 인증 정보 설정
    req.storeId = storeId;
    req.email = email;
    req.user = verifyResult.payload;

    next();
  } catch (err) {
    console.error('인증 미들웨어 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 선택적 인증 미들웨어
 *
 * 토큰이 있으면 검증하고, 없으면 그냥 통과시킵니다.
 * 공개 API와 인증 API를 함께 사용할 때 유용합니다.
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 토큰이 없으면 그냥 통과
    if (!authHeader) {
      return next();
    }

    // 토큰이 있으면 검증
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const verifyResult = verifyAccessToken(token);

      if (verifyResult.valid) {
        const { storeId, email } = verifyResult.payload;
        req.storeId = storeId;
        req.email = email;
        req.user = verifyResult.payload;
      }
    }

    next();
  } catch (err) {
    // 에러가 발생해도 통과 (선택적이므로)
    next();
  }
};
