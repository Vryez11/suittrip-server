/**
 * Reminder Scheduler
 * 체크아웃 30분 전 알림 발송 (setInterval로 1분마다 실행)
 *
 * 알림 #2: "체크아웃 30분 전이에요!"
 * 이미 발송한 알림은 sent_reminder_at으로 중복 방지
 */

import { query } from '../config/database.js';
import { sendPushNotification } from '../services/webPushService.js';

/**
 * 30분 후에 체크아웃인 예약 중 아직 알림 안 보낸 것 찾아서 발송
 */
export async function checkAndSendReminders() {
  try {
    // 30분 후 체크아웃인 예약 + 푸시 구독이 있는 것 + 아직 리마인더 안 보낸 것
    const rows = await query(
      `SELECT
         ps.id as subscriptionId,
         ps.reservation_id as reservationId,
         ps.endpoint,
         ps.p256dh,
         ps.auth,
         ps.locale,
         ps.sent_reminder_at,
         r.end_time as endTime,
         r.status,
         (SELECT business_name FROM stores WHERE id = r.store_id) as storeName,
         r.qr_code as accessToken
       FROM push_subscriptions ps
       JOIN reservations r ON ps.reservation_id = r.id
       WHERE r.status IN ('confirmed', 'in_progress')
         AND r.end_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 31 MINUTE)
         AND ps.sent_reminder_at IS NULL`
    );

    if (!rows || rows.length === 0) return;

    console.log(`[Reminder] ${rows.length}건 알림 발송 예정`);

    for (const row of rows) {
      const result = await sendPushNotification(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        'checkoutReminder',
        row.locale || 'en',
        {
          reservationId: row.reservationId,
          storeName: row.storeName,
          url: `/${row.locale || 'en'}/reservations/${row.reservationId}?token=${row.accessToken || ''}`,
        }
      );

      if (result.success) {
        // 발송 성공 기록 (중복 방지)
        await query(
          'UPDATE push_subscriptions SET sent_reminder_at = NOW() WHERE id = ?',
          [row.subscriptionId]
        );
        console.log(`[Reminder] Sent to reservation ${row.reservationId}`);
      } else if (result.shouldDelete) {
        // 구독 만료 → 삭제
        await query('DELETE FROM push_subscriptions WHERE id = ?', [row.subscriptionId]);
        console.log(`[Reminder] Deleted expired subscription ${row.subscriptionId}`);
      }
    }
  } catch (err) {
    console.error('[Reminder] Scheduler error:', err.message);
  }
}
