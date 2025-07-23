// Standalone types for Documents Table - recreated without GraphQL dependencies

export const DocumentType = {
  Invoice: 'Invoice',
  InvoiceReceipt: 'InvoiceReceipt', 
  Receipt: 'Receipt',
  CreditInvoice: 'CreditInvoice',
  Proforma: 'Proforma',
  Unprocessed: 'Unprocessed',
  Other: 'Other',
} as const;

export type DocumentType = typeof DocumentType[keyof typeof DocumentType];

export const Currency = {
  Ils: 'ILS',
  Usd: 'USD',
  Eur: 'EUR',
  Gbp: 'GBP',
  Jpy: 'JPY',
} as const;

export type Currency = typeof Currency[keyof typeof Currency];

export interface Amount {
  raw: number;
  formatted: string;
  currency: Currency;
}

export interface Business {
  id: string;
  name: string;
}

export interface MissingInfoSuggestions {
  amount?: Amount;
  isIncome?: boolean;
  counterparty?: Business;
  owner?: Business;
}

// Base document interface that all documents inherit from
export interface BaseDocument {
  id: string;
  documentType: DocumentType;
  image?: string | null;
  file?: string | { href: string } | null;
  onUpdate: () => void;
  editDocument: () => void;
}

// Financial document extends base with financial fields
export interface FinancialDocument extends BaseDocument {
  amount?: Amount | null;
  missingInfoSuggestions?: MissingInfoSuggestions | null;
  date?: string | Date | null;
  vat?: Amount | null;
  serialNumber?: string | null;
  allocationNumber?: string | null;
  creditor?: Business | null;
  debtor?: Business | null;
}

// All documents are financial documents for this table
export type DocumentsTableRowType = FinancialDocument;

export interface DocumentsTableProps {
  data: DocumentsTableRowType[];
  onChange: () => void;
}

// Props for individual cell components
export interface AmountCellProps {
  document: DocumentsTableRowType;
}

export interface DateCellProps {
  document: DocumentsTableRowType;
}

export interface TypeCellProps {
  document: DocumentsTableRowType;
}

export interface SerialCellProps {
  document: DocumentsTableRowType;
}

export interface VatCellProps {
  document: DocumentsTableRowType;
}

export interface FilesCellProps {
  document: DocumentsTableRowType;
}

export interface CreditorCellProps {
  document: DocumentsTableRowType;
}

export interface DebtorCellProps {
  document: DocumentsTableRowType;
}

// Helper functions for document validation logic
export const DocumentValidation = {
  shouldHaveAmount: (documentType: DocumentType): boolean => {
    return documentType !== DocumentType.Other;
  },

  shouldHaveDate: (documentType: DocumentType): boolean => {
    return documentType !== DocumentType.Other;
  },

  shouldHaveVat: (documentType: DocumentType): boolean => {
    return documentType !== DocumentType.Other;
  },

  shouldHaveSerial: (documentType: DocumentType): boolean => {
    return documentType !== DocumentType.Other;
  },

  shouldHaveCreditor: (documentType: DocumentType): boolean => {
    return documentType !== DocumentType.Unprocessed && documentType !== DocumentType.Other;
  },

  shouldHaveDebtor: (documentType: DocumentType): boolean => {
    return documentType !== DocumentType.Unprocessed && documentType !== DocumentType.Other;
  },

  isErrorState: (documentType: DocumentType): boolean => {
    return documentType === DocumentType.Unprocessed;
  },

  isUnprocessed: (documentType: DocumentType): boolean => {
    return documentType === DocumentType.Unprocessed;
  }
};