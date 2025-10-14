/**
 * 데이터베이스 스키마 적용 스크립트
 *
 * 사용법:
 *   node database/apply-schema.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터베이스 연결 설정
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  multipleStatements: true, // 여러 SQL 문 실행 허용
};

/**
 * 스키마 파일 적용
 */
async function applySchema() {
  let connection;

  try {
    console.log('🔌 데이터베이스 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('✅ 데이터베이스 연결 성공');

    // 스키마 파일 읽기
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📖 스키마 파일 읽는 중: ${schemaPath}`);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 스키마 적용
    console.log('🚀 스키마 적용 중...');
    await connection.query(schema);
    console.log('✅ 스키마 적용 완료!');

    // 생성된 테이블 확인
    const dbName = process.env.DB_NAME || 'suittrip';
    await connection.query(`USE ${dbName}`);
    const [tables] = await connection.query('SHOW TABLES');

    console.log('\n📊 생성된 테이블 목록:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    console.log(`\n✅ 총 ${tables.length}개의 테이블이 생성되었습니다.`);

  } catch (error) {
    console.error('❌ 스키마 적용 실패:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
console.log('============================================');
console.log('  수뜨립 데이터베이스 스키마 적용');
console.log('============================================\n');

applySchema()
  .then(() => {
    console.log('\n✅ 모든 작업이 완료되었습니다!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  });
