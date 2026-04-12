/**
 * ?�훅 ?�비??
 * ?�스?�이먼츠 ?�훅 처리 비즈?�스 로직
 */

import { pool } from '../config/database.js';

/**
 * ?�스 ?�태�??�리 ?�스???�태�?매핑
 */
export function mapTossStatusToOurStatus(tossStatus) {
  const statusMap = {
    'READY': 'PENDING',
    'IN_PROGRESS': 'PENDING',
    'WAITING_FOR_DEPOSIT': 'PENDING',
    'DONE': 'SUCCESS',
    'CANCELED': 'CANCELED',
    'PARTIAL_CANCELED': 'CANCELED',
    'ABORTED': 'FAILED',
    'EXPIRED': 'FAILED',
  };

  return statusMap[tossStatus] || 'PENDING';
}

/**
 * ?�태 ?�이 검�?
 */
export function isValidStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    'PENDING': ['SUCCESS', 'FAILED', 'CANCELED'],
    'SUCCESS': ['CANCELED', 'REFUNDED'],
    'FAILED': [],
    'CANCELED': [],
    'REFUNDED': [],
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * ?�훅 멱등??체크
 */
export async function checkWebhookIdempotency(connection, orderId, eventType, status) {
  const [existingWebhooks] = await connection.query(
    `SELECT * FROM payment_webhooks 
     WHERE pg_order_id = ? 
     AND event_type = ? 
     AND status = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [orderId, eventType, status]
  );

  return existingWebhooks.length > 0;
}

/**
 * ?�훅 ?�력 ?�??
 */
export async function saveWebhookHistory(connection, webhookData) {
  const {
    paymentId,
    orderId,
    paymentKey,
    eventType,
    status,
    rawData,
  } = webhookData;

  const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  await connection.query(
    `INSERT INTO payment_webhooks (
      id,
      payment_id,
      pg_order_id,
      pg_payment_key,
      event_type,
      status,
      webhook_data,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      webhookId,
      paymentId,
      orderId,
      paymentKey || null,
      eventType,
      status,
      JSON.stringify(rawData),
    ]
  );

  return webhookId;
}

/**
 * 결제 ?�태 변�?처리
 */
export async function handlePaymentStatusChanged(connection, payment, data) {
  const { paymentKey, status, approvedAt, totalAmount, method } = data;
  
  const ourStatus = mapTossStatusToOurStatus(status);

  if (ourStatus === 'SUCCESS') {
    // 결제 ?�공
    await connection.query(
      `UPDATE payments
       SET status = ?,
           pg_payment_key = ?,
           pg_method = ?,
           paid_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        ourStatus,
        paymentKey,
        method || payment.pg_method,
        approvedAt ? new Date(approvedAt) : new Date(),
        payment.id,
      ]
    );

    // ?�결???�약???�으�??�약 ?�태???�데?�트 (가�??�인 ?��?
    if (payment.reservation_id) {
      await connection.query(
        `UPDATE reservations
         SET status = 'pending_approval',
             payment_status = 'paid',
             updated_at = NOW()
         WHERE id = ?`,
        [payment.reservation_id]
      );

    }


  } else if (ourStatus === 'FAILED') {
    // 결제 ?�패
    await connection.query(
      `UPDATE payments
       SET status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [ourStatus, payment.id]
    );

    // ?�약???�패 처리
    if (payment.reservation_id) {
      await connection.query(
        `UPDATE reservations
         SET payment_status = 'failed',
             updated_at = NOW()
         WHERE id = ?`,
        [payment.reservation_id]
      );
    }

  }
}

/**
 * 결제 취소 처리
 */
export async function handlePaymentCanceled(connection, payment, data) {
  const { paymentKey, cancels } = data;

  // 1. 결제 취소
  await connection.query(
    `UPDATE payments
     SET status = 'CANCELED',
         canceled_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [payment.id]
  );

  // 2. ?�약??취소 처리
  if (payment.reservation_id) {
    await connection.query(
      `UPDATE reservations
       SET status = 'canceled',
           payment_status = 'refunded',
           updated_at = NOW()
       WHERE id = ?`,
      [payment.reservation_id]
    );

  }

}

/**
 * ?�훅 처리 메인 로직
 */
export async function processWebhook(webhookData) {
  let connection;

  try {
    const {
      eventType,
      createdAt,
      data: {
        paymentKey,
        orderId,
        status,
        approvedAt,
        totalAmount,
        method,
        cancels,
      } = {},
    } = webhookData;

    // 1. ?�수 ?�드 검�?
    if (!eventType || !orderId) {
      throw new Error('?�훅 ?�수 ?�드 ?�락');
    }

    // 2. ?�랜??�� ?�작
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 3. 기존 결제 ?�보 조회 (FOR UPDATE�???걸기)
    const [payments] = await connection.query(
      'SELECT * FROM payments WHERE pg_order_id = ? FOR UPDATE',
      [orderId]
    );

    if (payments.length === 0) {
      throw new Error(`존재?��? ?�는 주문: ${orderId}`);
    }

    const payment = payments[0];

    // 4. 멱등??체크
    const isAlreadyProcessed = await checkWebhookIdempotency(
      connection,
      orderId,
      eventType,
      status
    );

    if (isAlreadyProcessed) {
      await connection.commit();
      return { success: true, message: 'Already processed (idempotent)' };
    }

    // 5. ?�훅 ?�력 ?�??
    await saveWebhookHistory(connection, {
      paymentId: payment.id,
      orderId,
      paymentKey,
      eventType,
      status,
      rawData: webhookData,
    });

    // 6. ?�태 ?�이 검�?
    const currentStatus = payment.status;
    const newStatus = mapTossStatusToOurStatus(status);

    if (!isValidStatusTransition(currentStatus, newStatus)) {
      console.warn(`?�️  ?�못???�태 ?�이: ${currentStatus} -> ${newStatus}`);
      await connection.commit();
      return { success: false, message: 'Invalid status transition' };
    }

    // 7. ?�벤???�?�별 처리
    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(connection, payment, {
          paymentKey,
          status,
          approvedAt,
          totalAmount,
          method,
        });
        break;

      case 'PAYMENT_CANCELED':
        await handlePaymentCanceled(connection, payment, {
          paymentKey,
          cancels,
        });
        break;

      default:
    }

    // 8. ?�랜??�� 커밋
    await connection.commit();

    return { success: true, message: 'Webhook processed successfully' };

  } catch (err) {
    console.error('???�훅 처리 ?�패:', err);
    
    if (connection) {
      await connection.rollback();
    }

    throw err;

  } finally {
    if (connection) {
      connection.release();
    }
  }
}
