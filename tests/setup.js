/**
 * Jest 테스트 전역 설정 (ES Modules)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 테스트 환경변수 설정
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;
process.env.JWT_ACCESS_TOKEN_SECRET = 'test-jwt-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-minimum-32-characters-long';
process.env.DB_NAME = 'suittrip_test';

// 타임존 설정
process.env.TZ = 'Asia/Seoul';

// 테스트 DB 스키마 자동 적용 (한 번만 실행)
const schemaApplied = process.env.TEST_SCHEMA_APPLIED;
if (!schemaApplied) {
  try {
    console.log('📦 테스트 DB 스키마 확인 중...');

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      // 스키마 파일이 있으면 적용
      execSync('npm run db:schema', {
        stdio: 'ignore',
        env: { ...process.env, TEST_SCHEMA_APPLIED: 'true' }
      });
      console.log('✅ 테스트 DB 스키마 적용 완료');
    }

    // 플래그 설정하여 중복 실행 방지
    process.env.TEST_SCHEMA_APPLIED = 'true';
  } catch (error) {
    console.warn('⚠️  테스트 DB 스키마 적용 실패 (무시하고 계속):', error.message);
  }
}

// ES Modules에서는 jest 전역 객체를 사용할 수 없으므로 제거
// jest.config.js의 testTimeout으로 설정됨
