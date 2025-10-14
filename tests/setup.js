/**
 * Jest 테스트 전역 설정
 */

// 테스트 환경변수 설정
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
process.env.DB_NAME = 'suittrip_test';

// 타임존 설정
process.env.TZ = 'Asia/Seoul';

// 전역 테스트 타임아웃 설정
jest.setTimeout(10000);

// 테스트 시작 전
beforeAll(async () => {
  console.log('🧪 테스트 환경 초기화 시작');
});

// 각 테스트 전
beforeEach(() => {
  // 모든 모의 함수 초기화
  jest.clearAllMocks();
});

// 각 테스트 후
afterEach(() => {
  // 정리 작업
});

// 모든 테스트 후
afterAll(async () => {
  console.log('🧪 테스트 환경 정리 완료');
});
