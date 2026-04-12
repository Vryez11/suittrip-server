/**
 * 고객 디바이스(푸시토큰) 관리 컨트롤러
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';

/**
 * 디바이스 등록/업데이트
 * POST /api/customer/devices
 * 같은 pushToken이면 업데이트, 없으면 신규 생성
 */
export const registerDevice = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { pushToken, deviceType, deviceName } = req.body;

    if (!pushToken || !deviceType) {
      return res.status(400).json(
        error('VALIDATION_ERROR', 'pushToken, deviceType이 필요합니다', {
          required: ['pushToken', 'deviceType'],
        })
      );
    }

    if (!['ios', 'android'].includes(deviceType)) {
      return res.status(400).json(
        error('VALIDATION_ERROR', 'deviceType은 ios 또는 android여야 합니다')
      );
    }

    // 같은 토큰이 이미 등록되어 있으면 업데이트
    const existing = await query(
      'SELECT id FROM customer_devices WHERE push_token = ? LIMIT 1',
      [pushToken]
    );

    if (existing && existing.length > 0) {
      await query(
        `UPDATE customer_devices
         SET customer_id = ?, device_name = COALESCE(?, device_name),
             is_active = 1, last_login_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [customerId, deviceName || null, existing[0].id]
      );

      return res.json(success({ id: existing[0].id, pushToken, deviceType }, '디바이스 업데이트 완료'));
    }

    // 신규 등록
    const deviceId = `dev_${uuidv4()}`;
    await query(
      `INSERT INTO customer_devices (id, customer_id, push_token, device_type, device_name, is_active, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
      [deviceId, customerId, pushToken, deviceType, deviceName || null]
    );

    return res.status(201).json(success({ id: deviceId, pushToken, deviceType }, '디바이스 등록 완료'));
  } catch (err) {
    console.error('[registerDevice] error:', err);
    // 테이블이 없는 경우 친절한 에러
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(
        error('DB_MIGRATION_NEEDED', 'customer_devices 테이블이 없습니다. 마이그레이션을 실행하세요.')
      );
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 내 디바이스 목록 조회
 * GET /api/customer/devices
 */
export const getDevices = async (req, res) => {
  try {
    const customerId = req.customerId;

    const rows = await query(
      `SELECT id, push_token as pushToken, device_type as deviceType, device_name as deviceName,
              is_active as isActive, last_login_at as lastLoginAt, created_at as createdAt
       FROM customer_devices
       WHERE customer_id = ? AND is_active = 1
       ORDER BY last_login_at DESC`,
      [customerId]
    );

    return res.json(success(rows || []));
  } catch (err) {
    console.error('[getDevices] error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json(success([]));
    }
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};

/**
 * 디바이스 삭제 (비활성화)
 * DELETE /api/customer/devices/:deviceId
 */
export const removeDevice = async (req, res) => {
  try {
    const customerId = req.customerId;
    const { deviceId } = req.params;

    const result = await query(
      'UPDATE customer_devices SET is_active = 0, updated_at = NOW() WHERE id = ? AND customer_id = ?',
      [deviceId, customerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(error('NOT_FOUND', '디바이스를 찾을 수 없습니다'));
    }

    return res.json(success({ id: deviceId, deleted: true }, '디바이스 삭제 완료'));
  } catch (err) {
    console.error('[removeDevice] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다', { message: err.message }));
  }
};
