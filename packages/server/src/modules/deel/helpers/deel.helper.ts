import type { IGetDocumentsByChargeIdResult } from '@modules/documents/types';
import { dateToTimelessDateString } from '@shared/helpers';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import { DeelProvider } from '../providers/deel.provider.js';

const DEEL_BUSINESS_ID = '8d34f668-7233-4ce3-9c9c-82550b0839ff';

export async function getDeelEmployeeId(
  context: GraphQLModules.ModuleContext,
  document: IGetDocumentsByChargeIdResult,
  ledgerEntry: StrictLedgerProto,
  ledgerEntries: LedgerProto[],
): Promise<void> {
  if (
    (document.creditor_id !== DEEL_BUSINESS_ID && document.debtor_id !== DEEL_BUSINESS_ID) ||
    (document.type !== 'INVOICE' &&
      document.type !== 'INVOICE_RECEIPT' &&
      document.type !== 'CREDIT_INVOICE')
  ) {
    return;
  }

  const isDeelCreditor = ledgerEntry.creditAccountID1 === DEEL_BUSINESS_ID;
  // naive fetch employee id from deel
  let employeeId = await context.injector
    .get(DeelProvider)
    .getEmployeeIdByDocumentIdLoader.load(document.id);

  if (!employeeId && document.date && document.type) {
    // figure out through deel records
    const records = await context.injector
      .get(DeelProvider)
      .getDocumentRecordsByInvoiceDateLoader.load(dateToTimelessDateString(document.date));

    const matchingRecord = records.find(r => {
      if (r.invoice_date.getTime() !== document.date?.getTime()) {
        return false;
      }
      if (r.invoice_serial !== document.serial_number) {
        return false;
      }
      if (r.currency !== document.currency_code) {
        return false;
      }
      if (Number(r.amount) !== document.total_amount) {
        if (records.length === 1) {
          return false;
        }
        const spreadRecords = records.filter(r => r.invoice_serial === document.serial_number);
        if (spreadRecords.length === 1) {
          return false;
        }
        const totalAmount = spreadRecords.reduce((acc, r) => acc + Number(r.amount), 0);
        if (totalAmount !== document.total_amount) {
          return false;
        }
      }
      return true;
    });
    if (matchingRecord) {
      if (!matchingRecord.document_id) {
        // update Deel record
        await context.injector.get(DeelProvider).updateDocumentRecord({
          documentId: document.id,
          recordId: matchingRecord.id,
        });
      }
      if (matchingRecord.document_id && matchingRecord.document_id !== document.id) {
        console.log('this is weird...');
      }

      if (matchingRecord?.deel_worker_id) {
        employeeId = await context.injector
          .get(DeelProvider)
          .getEmployeeIDByDeelIdLoader.load(matchingRecord.deel_worker_id);
      }
    }
  }

  if (employeeId) {
    if (isDeelCreditor) {
      ledgerEntries.push({
        ...ledgerEntry,
        debitAccountID1: employeeId,
      });
      ledgerEntry.creditAccountID1 = employeeId;
    } else {
      ledgerEntries.push({
        ...ledgerEntry,
        creditAccountID1: employeeId,
      });
      ledgerEntry.debitAccountID1 = employeeId;
    }
  }

  return;
}
