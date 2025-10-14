/**
 * 데이터베이스 연결 테스트
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getConnection, closePool, query } from '../../src/config/database.js';

describe('Database Connection Tests', () => {
  afterAll(async () => {
    await closePool();
  });

  test('데이터베이스 연결이 성공해야 함', async () => {
    const connection = await getConnection();
    expect(connection).toBeDefined();
    connection.release();
  });

  test('쿼리 실행이 성공해야 함', async () => {
    const result = await query('SELECT 1 + 1 AS result');
    expect(result).toBeDefined();
    expect(result[0].result).toBe(2);
  });

  test('데이터베이스 이름이 올바른지 확인', async () => {
    const result = await query('SELECT DATABASE() AS dbName');
    expect(result[0].dbName).toBe(process.env.DB_NAME);
  });

  test('연결 풀이 정상적으로 작동하는지 확인', async () => {
    const promises = [];
    // 동시에 5개의 연결 요청
    for (let i = 0; i < 5; i++) {
      promises.push(
        getConnection().then((conn) => {
          conn.release();
          return true;
        })
      );
    }
    const results = await Promise.all(promises);
    expect(results.every((r) => r === true)).toBe(true);
  });

  test('잘못된 쿼리는 에러를 반환해야 함', async () => {
    await expect(query('INVALID SQL QUERY')).rejects.toThrow();
  });
});
