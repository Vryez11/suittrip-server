/**
 * 수뜨립(Suittrip) 백엔드 서버
 * 서버 진입점
 */

import app from './src/app.js';
import { closePool } from './src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

// 포트 설정
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 서버 시작
const server = app.listen(PORT, () => {
  console.log('============================================');
  console.log('  수뜨립(Suittrip) 백엔드 서버');
  console.log('============================================');
  console.log(`🚀 서버가 시작되었습니다!`);
  console.log(`📍 포트: ${PORT}`);
  console.log(`🌍 환경: ${NODE_ENV}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`💚 헬스체크: http://localhost:${PORT}/health`);
  console.log('============================================\n');
});

// Graceful Shutdown 처리
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} 신호를 받았습니다. 서버를 종료합니다...`);

  // 서버 종료
  server.close(async () => {
    console.log('✅ HTTP 서버가 종료되었습니다.');

    try {
      // 데이터베이스 연결 종료
      await closePool();
      console.log('✅ 데이터베이스 연결이 종료되었습니다.');

      console.log('✅ 모든 리소스가 정리되었습니다. 안전하게 종료합니다.');
      process.exit(0);
    } catch (error) {
      console.error('❌ 종료 중 오류 발생:', error);
      process.exit(1);
    }
  });

  // 30초 후 강제 종료
  setTimeout(() => {
    console.error('❌ 강제 종료: 정상 종료 시간 초과');
    process.exit(1);
  }, 30000);
};

// 시그널 핸들러 등록
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 처리되지 않은 Promise 에러 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
  console.error('Promise:', promise);
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default server;
