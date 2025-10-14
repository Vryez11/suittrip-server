/**
 * Jest 테스트 전역 설정 (ES Modules)
 */

// 테스트 환경변수 설정
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
process.env.DB_NAME = 'suittrip_test';

// 타임존 설정
process.env.TZ = 'Asia/Seoul';

// ES Modules에서는 jest 전역 객체를 사용할 수 없으므로 제거
// jest.config.js의 testTimeout으로 설정됨
