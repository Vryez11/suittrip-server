/**
 * Push Subscription Controller
 * 웹 푸시 구독 저장 + 예약 완료 알림 즉시 발송
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';
import { sendPushNotification, VAPID_PUBLIC_KEY } from '../services/webPushService.js';

/**
 * 푸시 구독 저장 + 알림 #1 즉시 발송
 * POST /api/guest/push/subscribe
 */
export const subscribe = async (req, res) => {
  try {
    const { reservationId, subscription, locale = 'en' } = req.body;

    if (!reservationId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '필수 정보가 누락되었습니다', {
          required: ['reservationId', 'subscription.endpoint', 'subscription.keys.p256dh', 'subscription.keys.auth'],
        })
      );
    }

    // 예약 존재 확인
    const [reservation] = await query(
      `SELECT id, store_id, customer_name, end_time,
         (SELECT business_name FROM stores WHERE id = r.store_id) as storeName
       FROM reservations r WHERE id = ?`,
      [reservationId]
    );

    if (!reservation) {
      return res.status(404).json(error('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다'));
    }

    // 중복 구독 방지 (같은 예약 + 같은 endpoint)
    const [existing] = await query(
      'SELECT id FROM push_subscriptions WHERE reservation_id = ? AND endpoint = ? LIMIT 1',
      [reservationId, subscription.endpoint]
    );

    if (existing) {
      return res.json(success({ alreadySubscribed: true }, '이미 알림이 등록되어 있습니다'));
    }

    // DB 저장
    await query(
      `INSERT INTO push_subscriptions (reservation_id, endpoint, p256dh, auth, locale, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [reservationId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, locale]
    );

    // 알림 #1: 예약 완료 알림 즉시 발송
    const pushResult = await sendPushNotification(
      { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      'reservationComplete',
      locale,
      {
        reservationId,
        storeName: reservation.storeName,
        url: `/${locale}/reservations/${reservationId}`,
      }
    );

    return res.status(201).json(
      success({
        subscribed: true,
        firstNotificationSent: pushResult.success,
      }, '알림이 등록되었습니다')
    );
  } catch (err) {
    console.error('[pushSubscribe] error:', err);
    return res.status(500).json(error('INTERNAL_ERROR', '서버 오류가 발생했습니다'));
  }
};

/**
 * VAPID 공개키 조회 (프론트에서 구독 시 필요)
 * GET /api/guest/push/vapid-key
 */
export const getVapidKey = async (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json(error('PUSH_NOT_CONFIGURED', '푸시 알림이 설정되지 않았습니다'));
  }

  return res.json(success({ vapidPublicKey: VAPID_PUBLIC_KEY }));
};
