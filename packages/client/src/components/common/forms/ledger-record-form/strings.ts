/**
 * Language of the ledger record dialogs (insert and edit) and their form. The rest of the app is
 * English-only, so this is deliberately local to them rather than global i18n machinery. English
 * is the default; the choice is remembered in the browser.
 */
export type LedgerFormLang = 'en' | 'he';

/** Validation messages of the form's schema */
export type LedgerFormMessages = {
  dateRequired: string;
  dateFormat: string;
  dateAfterLock: (ledgerLock: string) => string;
  entityRequired: string;
  entityRequiredWithAmount: string;
  amountRequired: string;
  amountPositive: string;
  amountNumber: string;
  foreignAmountNumber: string;
  foreignAmountRequired: (currency: string) => string;
  foreignAmountPositive: string;
  currencyRequired: string;
  operationRequired: string;
  unbalanced: (debit: number, credit: number) => string;
};

export type LedgerFormStrings = {
  // Dialogs
  insertTitle: string;
  insertNewChargeTitle: string;
  insertDescription: string;
  insertNewChargeDescription: string;
  editTitle: string;
  editDescription: string;
  /** The language toggle: its visible text and accessible name, both naming the other language */
  switchLanguageText: string;
  switchLanguageLabel: string;
  // Fields
  operation: string;
  selectOperation: string;
  operationMiscExpense: string;
  operationDocument: string;
  operationTransactionComingSoon: string;
  currency: string;
  invoiceDate: string;
  valueDate: string;
  description: string;
  reference: string;
  // Lines
  debit: string;
  credit: string;
  /** "Debit" / "Credit" for a main line, "Debit 2" / "Credit 2" for a secondary one */
  slotLabel: (sideLabel: string, index: number) => string;
  entityPlaceholder: (slotLabel: string) => string;
  noEntity: string;
  clearSlot: (slotLabel: string) => string;
  amountLabel: (slotLabel: string) => string;
  foreignAmountLabel: (slotLabel: string) => string;
  amountPlaceholder: string;
  localAmountPlaceholder: string;
  foreignAmountPlaceholder: string;
  // Totals and submit
  debitTotal: string;
  creditTotal: string;
  difference: string;
  balanceError: string;
  addRecord: string;
  save: string;
  messages: LedgerFormMessages;
};

const EN: LedgerFormStrings = {
  insertTitle: 'Add ledger record',
  insertNewChargeTitle: 'Add ledger record (new charge)',
  insertDescription:
    'Creates the ledger record together with the misc expense or document it represents.',
  insertNewChargeDescription:
    'Creates a new charge, with the ledger record and the misc expense or document it represents.',
  editTitle: 'Edit ledger record',
  editDescription:
    'Overwrites the stored record. The misc expense or document behind it is not changed.',
  switchLanguageText: 'עב',
  switchLanguageLabel: 'Switch to Hebrew',
  operation: 'Operation',
  selectOperation: 'Select operation',
  operationMiscExpense: 'Misc expense',
  operationDocument: 'Document',
  operationTransactionComingSoon: 'Transaction (coming soon)',
  currency: 'Currency',
  invoiceDate: 'Invoice date',
  valueDate: 'Value date',
  description: 'Description',
  reference: 'Reference',
  debit: 'Debit',
  credit: 'Credit',
  slotLabel: (sideLabel, index) => (index === 1 ? sideLabel : `${sideLabel} ${index}`),
  entityPlaceholder: slotLabel => `${slotLabel} entity`,
  noEntity: 'None',
  clearSlot: slotLabel => `Clear ${slotLabel}`,
  amountLabel: slotLabel => `${slotLabel} amount`,
  foreignAmountLabel: slotLabel => `${slotLabel} foreign amount`,
  amountPlaceholder: 'Amount',
  localAmountPlaceholder: 'Local amount',
  // Short, so the currency symbol beside it doesn't clip it in a narrow column
  foreignAmountPlaceholder: 'Foreign',
  debitTotal: 'Debit total',
  creditTotal: 'Credit total',
  difference: 'Difference',
  balanceError: 'Debit and credit totals must be equal',
  addRecord: 'Add record',
  save: 'Save',
  messages: {
    dateRequired: 'Date is required',
    dateFormat: 'Date must be in format yyyy-mm-dd',
    dateAfterLock: ledgerLock => `Date must be after ${ledgerLock}`,
    entityRequired: 'Entity is required',
    entityRequiredWithAmount: 'Entity is required when an amount is entered',
    amountRequired: 'Amount is required',
    amountPositive: 'Amount must be greater than 0',
    amountNumber: 'Amount must be a number',
    foreignAmountNumber: 'Foreign amount must be a number',
    foreignAmountRequired: currency => `Foreign amount is required for ${currency} records`,
    foreignAmountPositive: 'Foreign amount must be greater than 0',
    currencyRequired: 'Currency is required',
    operationRequired: 'Operation is required',
    unbalanced: (debit, credit) =>
      `Debit and credit totals must be equal (debit ${debit}, credit ${credit})`,
  },
};

const HE: LedgerFormStrings = {
  insertTitle: 'הוספת רשומת יומן',
  insertNewChargeTitle: 'הוספת רשומת יומן (חיוב חדש)',
  insertDescription: 'יוצר את רשומת היומן יחד עם ההוצאה השונה או המסמך שהיא מייצגת.',
  insertNewChargeDescription:
    'יוצר חיוב חדש, ובו את רשומת היומן ואת ההוצאה השונה או המסמך שהיא מייצגת.',
  editTitle: 'עריכת רשומת יומן',
  editDescription: 'דורס את הרשומה השמורה. ההוצאה השונה או המסמך שמאחוריה אינם משתנים.',
  switchLanguageText: 'EN',
  switchLanguageLabel: 'החלפה לאנגלית',
  operation: 'פעולה',
  selectOperation: 'בחירת פעולה',
  operationMiscExpense: 'הוצאה שונה',
  operationDocument: 'מסמך',
  operationTransactionComingSoon: 'תנועה (בקרוב)',
  currency: 'מטבע',
  invoiceDate: 'תאריך חשבונית',
  valueDate: 'תאריך ערך',
  description: 'תיאור',
  reference: 'אסמכתא',
  debit: 'חובה',
  credit: 'זכות',
  slotLabel: (sideLabel, index) => (index === 1 ? sideLabel : `${sideLabel} ${index}`),
  entityPlaceholder: slotLabel => `ישות ${slotLabel}`,
  noEntity: 'ללא',
  clearSlot: slotLabel => `ניקוי ${slotLabel}`,
  amountLabel: slotLabel => `סכום ${slotLabel}`,
  foreignAmountLabel: slotLabel => `סכום מט״ח ${slotLabel}`,
  amountPlaceholder: 'סכום',
  localAmountPlaceholder: 'סכום מקומי',
  foreignAmountPlaceholder: 'מט״ח',
  debitTotal: 'סה״כ חובה',
  creditTotal: 'סה״כ זכות',
  difference: 'הפרש',
  balanceError: 'סה״כ החובה והזכות חייבים להיות שווים',
  addRecord: 'הוספת רשומה',
  save: 'שמירה',
  messages: {
    dateRequired: 'יש להזין תאריך',
    dateFormat: 'התאריך חייב להיות בפורמט yyyy-mm-dd',
    dateAfterLock: ledgerLock => `התאריך חייב להיות אחרי ${ledgerLock}`,
    entityRequired: 'יש לבחור ישות',
    entityRequiredWithAmount: 'יש לבחור ישות כאשר מוזן סכום',
    amountRequired: 'יש להזין סכום',
    amountPositive: 'הסכום חייב להיות גדול מ-0',
    amountNumber: 'הסכום חייב להיות מספר',
    foreignAmountNumber: 'סכום המט״ח חייב להיות מספר',
    foreignAmountRequired: currency => `יש להזין סכום מט״ח ברשומה ב-${currency}`,
    foreignAmountPositive: 'סכום המט״ח חייב להיות גדול מ-0',
    currencyRequired: 'יש לבחור מטבע',
    operationRequired: 'יש לבחור פעולה',
    unbalanced: (debit, credit) =>
      `סה״כ החובה והזכות חייבים להיות שווים (חובה ${debit}, זכות ${credit})`,
  },
};

export const LEDGER_FORM_STRINGS: Record<LedgerFormLang, LedgerFormStrings> = { en: EN, he: HE };
