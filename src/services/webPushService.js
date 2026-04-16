/**
 * Web Push Service
 * VAPID 기반 웹 푸시 알림 발송
 *
 * 알림은 딱 2종류만:
 * 1. 예약 완료 (구독 즉시)
 * 2. 체크아웃 30분 전 (스케줄러)
 */

import webpush from 'web-push';

// VAPID 키 설정
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@lifeistravel.io';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] VAPID configured');
} else {
  console.warn('[WebPush] VAPID keys not set — push notifications disabled');
}

/**
 * 다국어 알림 메시지
 */
const MESSAGES = {
  reservationComplete: {
    ko: {
      title: '예약이 완료되었어요! 🧳',
      body: '체크아웃 30분 전에 알림이 한 번 더 갈 거예요! 다른 마케팅 알림은 없으니 걱정마세요! 매장에서 사용가능한 쿠폰도 발급되었으니 일주일 안에 사용해주세요~',
    },
    en: {
      title: 'Reservation confirmed! 🧳',
      body: "We'll remind you 30 min before checkout. No marketing notifications, promise! A store coupon has been issued — use it within a week!",
    },
    ja: {
      title: '予約が完了しました！🧳',
      body: 'チェックアウト30分前にもう一度お知らせします！マーケティング通知は一切ありませんのでご安心ください！店舗で使えるクーポンも発行されましたので、1週間以内にご利用ください〜',
    },
    zh: {
      title: '预约完成！🧳',
      body: '我们会在退房前30分钟再通知您！不会发送任何营销通知，请放心！门店优惠券已发放，请在一周内使用~',
    },
  },
  checkoutReminder: {
    ko: {
      title: '체크아웃 30분 전이에요! ⏰',
      body: '체크아웃 15분 후까지는 추가 요금이 없어요! 15분 후부터는 추가 요금이 있으니 참고 부탁해요!',
    },
    en: {
      title: '30 min until checkout! ⏰',
      body: 'No extra charge for 15 min after checkout time. After that, additional fees may apply!',
    },
    ja: {
      title: 'チェックアウトまであと30分！⏰',
      body: 'チェックアウト後15分以内は追加料金がかかりません！15分を過ぎると追加料金が発生しますのでご注意ください！',
    },
    zh: {
      title: '距离退房还有30分钟！⏰',
      body: '退房后15分钟内不收取额外费用！超过15分钟后将产生额外费用，请留意！',
    },
  },
};

/**
 * 푸시 알림 발송
 * @param {Object} subscription — { endpoint, keys: { p256dh, auth } }
 * @param {string} type — 'reservationComplete' | 'checkoutReminder'
 * @param {string} locale — 'ko' | 'en' | 'ja' | 'zh'
 * @param {Object} data — 추가 데이터 (reservationId, storeName, url 등)
 */
export async function sendPushNotification(subscription, type, locale = 'en', data = {}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[WebPush] VAPID not configured, skipping push');
    return { success: false, reason: 'VAPID_NOT_CONFIGURED' };
  }

  const messages = MESSAGES[type];
  if (!messages) {
    return { success: false, reason: 'UNKNOWN_MESSAGE_TYPE' };
  }

  const msg = messages[locale] || messages.en;

  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    icon: '/icons/lit-icon-192.png',
    badge: '/icons/lit-badge-72.png',
    tag: `lit-${type}-${data.reservationId || 'unknown'}`,
    data: {
      url: data.url || '/',
      reservationId: data.reservationId,
      type,
    },
    actions: type === 'checkoutReminder'
      ? [{ action: 'directions', title: locale === 'ko' ? '길찾기' : 'Directions' }]
      : [],
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload,
      { TTL: 3600 }
    );

    return { success: true };
  } catch (err) {
    console.error(`[WebPush] Send failed for ${type}:`, err.statusCode || err.message);

    // 410 Gone = 구독 만료, 삭제 필요
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { success: false, reason: 'SUBSCRIPTION_EXPIRED', shouldDelete: true };
    }

    return { success: false, reason: err.message };
  }
}

export { VAPID_PUBLIC_KEY };
