/**
 * 통계 컨트롤러
 * Phase 4 - 통계 APIs
 */

import { success, error } from '../utils/response.js';
import { query } from '../config/database.js';

/**
 * 일별 통계 조회
 * GET /api/statistics/daily
 */
export const getDailyStatistics = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { startDate, endDate } = req.query;

    // 날짜 범위 설정 (기본값: 최근 30일)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // daily_statistics 테이블에서 데이터 조회
    const statistics = await query(
      `SELECT
        date, total_reservations as totalReservations,
        completed_reservations as completedReservations,
        cancelled_reservations as cancelledReservations,
        total_revenue as totalRevenue,
        average_occupancy_rate as averageOccupancyRate,
        new_customers as newCustomers
      FROM daily_statistics
      WHERE store_id = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC`,
      [storeId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    );

    // 테이블에 데이터가 없으면 실시간 집계
    if (!statistics || statistics.length === 0) {
      const realtimeStats = await query(
        `SELECT
          DATE(created_at) as date,
          COUNT(*) as totalReservations,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedReservations,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledReservations,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as totalRevenue
        FROM reservations
        WHERE store_id = ? AND DATE(created_at) BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date DESC`,
        [storeId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
      );

      // Flutter DailyStatData 형식에 맞춤 (day, revenue, reservations)
      return res.json(
        success(
          {
            dailyData: realtimeStats.map(stat => ({
              day: stat.date instanceof Date ? stat.date.toISOString().split('T')[0] : stat.date,
              revenue: Number(stat.totalRevenue),
              reservations: Number(stat.totalReservations),
            })),
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
          },
          '일별 통계 조회 성공 (실시간 집계)'
        )
      );
    }

    // Flutter DailyStatData 형식에 맞춤 (day, revenue, reservations)
    return res.json(
      success(
        {
          dailyData: statistics.map(stat => ({
            day: stat.date instanceof Date ? stat.date.toISOString().split('T')[0] : stat.date,
            revenue: Number(stat.totalRevenue),
            reservations: Number(stat.totalReservations),
          })),
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        },
        '일별 통계 조회 성공'
      )
    );
  } catch (err) {
    console.error('일별 통계 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 월별 통계 조회
 * GET /api/statistics/monthly
 */
export const getMonthlyStatistics = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { year } = req.query;

    // 연도 설정 (기본값: 현재 연도)
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // 월별 통계 집계
    const statistics = await query(
      `SELECT
        YEAR(created_at) as year,
        MONTH(created_at) as month,
        COUNT(*) as totalReservations,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedReservations,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledReservations,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as totalRevenue,
        COALESCE(AVG(total_amount), 0) as averageOrderValue
      FROM reservations
      WHERE store_id = ? AND YEAR(created_at) = ?
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY month`,
      [storeId, targetYear]
    );

    // 12개월 데이터 생성 (데이터가 없는 월은 0으로 채움)
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const stat = statistics.find(s => s.month === month);
      monthlyData.push({
        year: targetYear,
        month,
        totalReservations: stat ? Number(stat.totalReservations) : 0,
        completedReservations: stat ? Number(stat.completedReservations) : 0,
        cancelledReservations: stat ? Number(stat.cancelledReservations) : 0,
        totalRevenue: stat ? Number(stat.totalRevenue) : 0,
        averageOrderValue: stat ? Number(stat.averageOrderValue) : 0,
      });
    }

    // 연간 합계 계산
    const yearlyTotal = {
      totalReservations: monthlyData.reduce((sum, m) => sum + m.totalReservations, 0),
      completedReservations: monthlyData.reduce((sum, m) => sum + m.completedReservations, 0),
      cancelledReservations: monthlyData.reduce((sum, m) => sum + m.cancelledReservations, 0),
      totalRevenue: monthlyData.reduce((sum, m) => sum + m.totalRevenue, 0),
    };

    return res.json(
      success(
        {
          year: targetYear,
          monthly: monthlyData,
          yearlyTotal,
        },
        '월별 통계 조회 성공'
      )
    );
  } catch (err) {
    console.error('월별 통계 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};

/**
 * 매출 통계 조회
 * GET /api/statistics/revenue
 */
export const getRevenueStatistics = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { period = 'monthly', startDate, endDate } = req.query;

    let groupBy = '';
    let dateFormat = '';

    switch (period) {
      case 'daily':
        groupBy = 'DATE(created_at)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        groupBy = 'YEARWEEK(created_at)';
        dateFormat = '%Y-W%v';
        break;
      case 'yearly':
        groupBy = 'YEAR(created_at)';
        dateFormat = '%Y';
        break;
      case 'monthly':
      default:
        groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        dateFormat = '%Y-%m';
        break;
    }

    // 날짜 범위 설정
    let dateCondition = '';
    const params = [storeId];

    if (startDate && endDate) {
      dateCondition = 'AND DATE(created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (period === 'monthly') {
      // 기본값: 최근 12개월
      dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)';
    }

    // 매출 통계 조회
    const revenueStats = await query(
      `SELECT
        DATE_FORMAT(created_at, ?) as period,
        COUNT(*) as totalOrders,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as totalRevenue,
        COALESCE(AVG(CASE WHEN payment_status = 'paid' THEN total_amount ELSE NULL END), 0) as averageOrderValue,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paidOrders,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
        SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) as refundedOrders
      FROM reservations
      WHERE store_id = ? ${dateCondition}
      GROUP BY ${groupBy}
      ORDER BY period DESC`,
      [dateFormat, ...params]
    );

    // 결제 수단별 통계
    const paymentMethodStats = await query(
      `SELECT
        payment_method as paymentMethod,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM reservations
      WHERE store_id = ? AND payment_status = 'paid' ${dateCondition}
      GROUP BY payment_method`,
      params
    );

    // 보관함 타입별 매출 통계
    const storageTypeStats = await query(
      `SELECT
        s.type as storageType,
        COUNT(r.id) as count,
        COALESCE(SUM(r.total_amount), 0) as revenue
      FROM reservations r
      LEFT JOIN storages s ON r.storage_id = s.id
      WHERE r.store_id = ? AND r.payment_status = 'paid' ${dateCondition}
      GROUP BY s.type`,
      params
    );

    return res.json(
      success(
        {
          period,
          revenueByPeriod: revenueStats.map(stat => ({
            period: stat.period,
            totalOrders: Number(stat.totalOrders),
            totalRevenue: Number(stat.totalRevenue),
            averageOrderValue: Number(stat.averageOrderValue),
            paidOrders: Number(stat.paidOrders),
            pendingOrders: Number(stat.pendingOrders),
            refundedOrders: Number(stat.refundedOrders),
          })),
          paymentMethodBreakdown: paymentMethodStats.map(stat => ({
            paymentMethod: stat.paymentMethod,
            count: Number(stat.count),
            revenue: Number(stat.revenue),
          })),
          storageTypeBreakdown: storageTypeStats.map(stat => ({
            storageType: stat.storageType || 'unknown',
            count: Number(stat.count),
            revenue: Number(stat.revenue),
          })),
        },
        '매출 통계 조회 성공'
      )
    );
  } catch (err) {
    console.error('매출 통계 조회 중 에러:', err);
    return res.status(500).json(
      error('INTERNAL_ERROR', '서버 오류가 발생했습니다', {
        message: err.message,
      })
    );
  }
};
