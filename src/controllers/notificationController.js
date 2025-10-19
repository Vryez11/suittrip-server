/**
 * 알림 컨트롤러
 * Phase 4 - 알림 APIs
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';

/**
 * 알림 목록 조회
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const storeId = req.storeId;
    const {
      isRead,
      type,
      page = 1,
      limit = 20,
    } = req.query;

    // 필터 조건 구성
    const conditions = ['store_id = ?'];
    const params = [storeId];

    if (isRead !== undefined) {
      conditions.push('is_read = ?');
      params.push(isRead === 'true' ? 1 : 0);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
      params
    );
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // 페이지네이션 계산
    const offset = (page - 1) * limit;

    // 알림 목록 조회
    const notifications = await query(
      `SELECT
        id, store_id as storeId, type, title, message,
        data, is_read as isRead, read_at as readAt,
        created_at as createdAt
      FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // 응답 데이터 구성
    const formattedNotifications = notifications.map(notification => {
      // data JSON 파싱
      let data = null;
      if (notification.data) {
        try {
          data = typeof notification.data === 'string'
            ? JSON.parse(notification.data)
            : notification.data;
        } catch (e) {
          console.error('[getNotifications] data 파싱 실패:', e);
        }
      }

      return {
        id: notification.id,
        storeId: notification.storeId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data,
        isRead: Boolean(notification.isRead),
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      };
    });

    // 읽지 않은 알림 수
    const unreadResult = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE store_id = ? AND is_read = 0',
      [storeId]
    );
    const unreadCount = unreadResult[0].count;

    return res.json(
      success(
        {
          notifications: formattedNotifications,
          unreadCount: Number(unreadCount),
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalItems,
            itemsPerPage: Number(limit),
          },
        },
        '알림 목록 조회 성공'
      )
    );
  } catch (err) {
    console.error('알림 목록 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 알림 단일 조회
 * GET /api/notifications/:id
 */
export const getNotification = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    const notifications = await query(
      `SELECT
        id, store_id as storeId, type, title, message,
        data, is_read as isRead, read_at as readAt,
        created_at as createdAt
      FROM notifications
      WHERE id = ? AND store_id = ?
      LIMIT 1`,
      [id, storeId]
    );

    if (!notifications || notifications.length === 0) {
      return res.status(404).json(
        error('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다')
      );
    }

    const notification = notifications[0];

    // data JSON 파싱
    let data = null;
    if (notification.data) {
      try {
        data = typeof notification.data === 'string'
          ? JSON.parse(notification.data)
          : notification.data;
      } catch (e) {
        console.error('[getNotification] data 파싱 실패:', e);
      }
    }

    const result = {
      id: notification.id,
      storeId: notification.storeId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data,
      isRead: Boolean(notification.isRead),
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };

    return res.json(success(result, '알림 조회 성공'));
  } catch (err) {
    console.error('알림 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 알림 읽음 처리
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    // 알림 존재 확인
    const notifications = await query(
      'SELECT id FROM notifications WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!notifications || notifications.length === 0) {
      return res.status(404).json(
        error('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다')
      );
    }

    // 읽음 처리
    await query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND store_id = ?',
      [id, storeId]
    );

    // 업데이트된 알림 조회
    const updatedNotifications = await query(
      `SELECT
        id, is_read as isRead, read_at as readAt
      FROM notifications
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return res.json(
      success(
        {
          id: updatedNotifications[0].id,
          isRead: Boolean(updatedNotifications[0].isRead),
          readAt: updatedNotifications[0].readAt,
        },
        '알림 읽음 처리 성공'
      )
    );
  } catch (err) {
    console.error('알림 읽음 처리 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 모든 알림 읽음 처리
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const storeId = req.storeId;

    // 모든 읽지 않은 알림을 읽음 처리
    const result = await query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE store_id = ? AND is_read = 0',
      [storeId]
    );

    return res.json(
      success(
        {
          updatedCount: result.affectedRows,
        },
        '모든 알림 읽음 처리 성공'
      )
    );
  } catch (err) {
    console.error('모든 알림 읽음 처리 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 알림 삭제
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    // 알림 존재 확인
    const notifications = await query(
      'SELECT id FROM notifications WHERE id = ? AND store_id = ? LIMIT 1',
      [id, storeId]
    );

    if (!notifications || notifications.length === 0) {
      return res.status(404).json(
        error('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다')
      );
    }

    // 알림 삭제
    await query('DELETE FROM notifications WHERE id = ? AND store_id = ?', [id, storeId]);

    return res.json(
      success(
        {
          id,
          deleted: true,
        },
        '알림 삭제 성공'
      )
    );
  } catch (err) {
    console.error('알림 삭제 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};
