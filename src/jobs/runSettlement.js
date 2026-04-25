/**
 * 정산 배치 실행 스크립트
 *
 * 사용법:
 *   node src/jobs/runSettlement.js
 *   node src/jobs/runSettlement.js --dry-run
 *   node src/jobs/runSettlement.js --start 2025-01-01 --end 2025-01-02
 *
 * 기본 기간은 어제 00:00부터 오늘 00:00까지입니다.
 */

import { runSettlementPeriod } from '../services/settlementService.js';
import { getYesterdayPeriod } from '../utils/settlementPeriod.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    startDate: null,
    endDate: null,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--start' && args[i + 1]) {
      options.startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end' && args[i + 1]) {
      options.endDate = args[i + 1];
      i++;
    }
  }

  return options;
}

function parseDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`유효하지 않은 날짜 형식입니다: ${dateStr}`);
  }
  return date;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function printSettlementSummary(result) {
  console.log(`정산 상태: ${result.status}`);
  console.log(`대상 결제: ${result.totalPayments ?? 0}건`);
  console.log(`정산 명세: ${result.totalStatements ?? 0}건`);

  if (result.totalPayout !== undefined) {
    console.log(`지급액 합계: ${result.totalPayout}원`);
  }
  if (result.totalCommission !== undefined) {
    console.log(`수수료 합계: ${result.totalCommission}원`);
  }

  if (result.settlements?.length) {
    result.settlements.forEach((settlement) => {
      const statement = settlement.statementId ? `statementId=${settlement.statementId}` : 'dry-run';
      console.log(
        `- storeId=${settlement.storeId}, ${statement}, payments=${settlement.paymentsCount}, payout=${settlement.payoutAmount}`
      );
    });
  }
}

async function main() {
  try {
    const options = parseArgs();

    let periodStart;
    let periodEnd;

    if (options.startDate && options.endDate) {
      periodStart = parseDate(options.startDate);
      periodEnd = parseDate(options.endDate);
    } else {
      const period = getYesterdayPeriod();
      periodStart = period.periodStart;
      periodEnd = period.periodEnd;
    }

    console.log(`정산 기간: ${formatDate(periodStart)} ~ ${formatDate(periodEnd)}`);
    if (options.dryRun) {
      console.log('드라이런 모드: DB 변경 없이 계산만 수행합니다.');
    }

    const result = await runSettlementPeriod({
      periodStart,
      periodEnd,
      dryRun: options.dryRun,
    });

    printSettlementSummary(result);
    process.exit(0);
  } catch (err) {
    console.error('\n정산 실패:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
