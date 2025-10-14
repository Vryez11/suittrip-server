export default {
  // 테스트 환경
  testEnvironment: 'node',

  // ES Modules 지원
  transform: {},
  extensionsToTreatAsEsm: ['.js'],

  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/app.js',
    '!src/config/**',
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // 테스트 파일 패턴
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
  ],

  // 테스트 타임아웃 (10초)
  testTimeout: 10000,

  // 상세 출력
  verbose: true,

  // 테스트 전역 설정
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 모의 객체 자동 초기화
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
