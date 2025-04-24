export type { HeaderCore as Header } from './schemas.js';
export type { TransactionCore as Transaction } from './schemas.js';

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

export interface Options {
  /**
   * defines if generator will throw error on minor/auto-fixable issue
   * default: false
   */
  strict?: boolean;
  /**
   * defines if generator will sort transactions (by entryType then invoiceDate)
   * default: true
   */
  sort?: boolean;
}
