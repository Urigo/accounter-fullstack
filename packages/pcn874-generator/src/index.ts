import type { Header, Options, Transaction } from './types.js';
import {
  footerBuilder,
  headerBuilder,
  headerHandler,
  transactionBuilder,
  transactionHandler,
} from './utils/index.js';

export enum EntryType {
  /**
   * Sales – "regular" sale
   * identified commercial customer
   * עסקה רגילה - מזוהה
   * */
  SALE_REGULAR = 'S1',

  /**
   * Sales – "Zero Value/Exempt" sale
   * not export
   * עסקה אפס - מזוהה
   * */
  SALE_ZERO_OR_EXEMPT = 'S2',

  /**
   * Sales – for unidentified (private) customer
   * /unidentified-cash
   * register aggregation etc
   * עסקה רגילה - לא מזוהה
   * */
  SALE_UNIDENTIFIED_CUSTOMER = 'L1',

  /**
   * Sales – for unidentified Zero Value/Exempt
   * private customer – aggregated
   * עסקה אפס - לא מזוהה
   * */
  SALE_UNIDENTIFIED_ZERO_OR_EXEMPT = 'L2',

  /**
   * Sales – self invoice
   * חשבונית עצמית (עסקה)
   * */
  SALE_SELF_INVOICE = 'M',

  /**
   * Sales – export
   * */
  SALE_EXPORT = 'Y',

  /**
   * Sales – Palestinian Authority customer. Palestinian customer – Invoice I
   * לקוח רש"פ
   * */
  SALE_PALESTINIAN_CUSTOMER = 'I',

  /**
   * Input – "regular" from Israeli Supplier
   * תשומה רגילה
   * */
  INPUT_REGULAR = 'T',

  /**
   * Input – Petty Cash. Various suppliers – Petty Cash
   * קופה קטנה
   * */
  INPUT_PETTY_CASH = 'K',

  /**
   * Input – Import. Overseas supplier
   * רשימון יבוא
   * */
  INPUT_IMPORT = 'R',

  /**
   * Input – Supplier from Palestinian Authority. Palestinian supplier – Invoice P
   * ספק רש"פ
   * */
  INPUT_PALESTINIAN_SUPPLIER = 'P',

  /**
   * Input – Single document by law. Such as Import entry, bank document etc.
   * מסמך אחר
   * */
  INPUT_SINGLE_DOC_BY_LAW = 'H',

  /**
   * Input – self invoice
   * חשבונית עצמית (תשומה)
   * */
  INPUT_SELF_INVOICE = 'C',
}

export const pcnGenerator = (
  header: Header,
  transactions: Transaction[],
  options: Options = {},
): string => {
  let textFile = '';

  // handle header
  try {
    header = headerHandler(header, options);
  } catch (e) {
    throw new Error(`Header validation error: ${(e as Error).message}`);
  }
  textFile += headerBuilder(header);

  // sort transactions
  const sortedTransactions = options.sort
    ? transactions.sort((a, b) => {
        if (a.entryType > b.entryType) {
          return 1;
        }
        if (a.entryType < b.entryType) {
          return -1;
        }
        return a.invoiceDate > b.invoiceDate ? 1 : -1;
      })
    : transactions;
  // handle transactions
  sortedTransactions.map((transaction, i) => {
    try {
      transaction = transactionHandler(transaction, options);
    } catch (e) {
      throw new Error(`Transaction index ${i} validation error: ${(e as Error).message}`);
    }
    textFile += transactionBuilder(transaction);
  });

  // handle footer
  textFile += footerBuilder(header);

  return textFile;
};
