import { getChargesHandler } from 'accounter-ledger-handler/index.js';
import { validateMatches } from 'match-validation.js';
import { matchesHandler } from 'matching-utils/index.js';
import { AccountingMovementsMap } from 'report-handler/accounting-movements.js';
import { logMatchSuccessRate } from 'utils/logger.js';
import { updateChargesAccountantApproval } from 'utils/server-requests.js';
import { ReportHandler } from './report-handler/report-handler.js';

function getReportAccountingMovements(
  filePath: string,
  encoding: BufferEncoding,
): AccountingMovementsMap {
  const report = new ReportHandler(filePath, encoding).getReport();
  const accountingMovements = report.accountingMovements;

  if (!accountingMovements) {
    throw new Error('Could not find accounting movements');
  }

  return accountingMovements;
}

function getYearFromMovements(accountingMovements: AccountingMovementsMap): string {
  const year = accountingMovements.getMovements()?.[0]?.date.slice(0, 4);

  if (!year) {
    throw new Error('Could not find year');
  }

  return year;
}

async function main() {
  const accountingMovementsHandler = getReportAccountingMovements('./BKMVDATA.txt', 'latin1');

  const year = getYearFromMovements(accountingMovementsHandler);

  const chargesHandler = await getChargesHandler(year);

  // do the matching
  matchesHandler(chargesHandler, accountingMovementsHandler);

  for (const charge of chargesHandler.getCharges()) {
    const subCount = chargesHandler.getSubLedgerRecordsByChargeId(charge.id)?.length ?? 0;
    if (!subCount) {
      if (charge.accountantApproval.approved) {
        throw new Error(
          `No sub-ledger records for charge ${charge.id} but it was approved by the accountant`,
        );
      }
      // console.warn(`No sub-ledger records for charge ${charge.id}`);
      continue;
    }
    const mismatchCount =
      chargesHandler.getUnmatchedSubLedgerRecordsByChargeId(charge.id)?.length ?? subCount;
    if (mismatchCount === 0 && !charge.accountantApproval.approved) {
      console.log(`All sub-ledger records for charge ${charge.id} were matched, approving...`);
      // await updateChargesAccountantApproval(charge.id, true);
      continue;
    }
    // console.warn(
    //   `Only ${subCount - mismatchCount} out of ${subCount} sub-ledger records for charge ${
    //     charge.id
    //   } were matched`,
    // );
  }

  logMatchSuccessRate(accountingMovementsHandler);

  validateMatches(accountingMovementsHandler.getMatchedData());
}

main();
