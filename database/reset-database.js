/**
 * 데이터베이스 초기화 스크립트
 *
 * 경고: 이 스크립트는 데이터베이스를 완전히 삭제하고 재생성합니다!
 *
 * 사용법:
 *   node database/reset-database.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

// 사용자 확인을 위한 인터페이스
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// 데이터베이스 연결 설정
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
};

/**
 * 데이터베이스 초기화
 */
async function resetDatabase() {
  const dbName = process.env.DB_NAME || 'suittrip';
  let connection;

  try {
    console.log('\n⚠️  경고: 이 작업은 데이터베이스를 완전히 삭제합니다!');
    console.log(`   대상 데이터베이스: ${dbName}\n`);

    const answer = await question('계속하시겠습니까? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ 작업이 취소되었습니다.');
      rl.close();
      process.exit(0);
    }

    console.log('\n🔌 데이터베이스 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('✅ 데이터베이스 연결 성공');

    // 데이터베이스 삭제
    console.log(`\n🗑️  데이터베이스 삭제 중: ${dbName}`);
    await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log('✅ 데이터베이스 삭제 완료');

    // 데이터베이스 재생성
    console.log(`\n🆕 데이터베이스 생성 중: ${dbName}`);
    await connection.query(
      `CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log('✅ 데이터베이스 생성 완료');

    console.log('\n✅ 데이터베이스 초기화 완료!');
    console.log('\n💡 다음 단계:');
    console.log('   node database/apply-schema.js  (스키마 적용)');

  } catch (error) {
    console.error('\n❌ 초기화 실패:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 데이터베이스 연결 종료\n');
    }
    rl.close();
  }
}

// 스크립트 실행
console.log('============================================');
console.log('  수뜨립 데이터베이스 초기화');
console.log('============================================');

resetDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  });
