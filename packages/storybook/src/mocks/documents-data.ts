import { DocumentsTableRowType, DocumentType, Currency, FinancialDocument } from '../components/documents-table/types';

// Mock businesses
export const mockBusinesses = [
  { id: '1', name: 'Acme Corp Ltd.' },
  { id: '2', name: 'Global Solutions Inc.' },
  { id: '3', name: 'Tech Innovations LLC' },
  { id: '4', name: 'Green Energy Co.' },
  { id: '5', name: 'Digital Marketing Pro' },
  { id: '6', name: 'Construction Masters' },
  { id: '7', name: 'Food & Beverage Ltd.' },
  { id: '8', name: 'Transportation Services' },
  { id: '9', name: 'Office Supplies Direct' },
  { id: '10', name: 'Professional Consulting' },
];

// Helper to create dates
const createDate = (daysAgo: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// Helper to get random business
const getRandomBusiness = () => mockBusinesses[Math.floor(Math.random() * mockBusinesses.length)];

// Mock financial documents
const createMockDocument = (
  id: string,
  documentType: DocumentType,
  overrides: Partial<FinancialDocument> = {}
): DocumentsTableRowType => {
  const hasImage = Math.random() > 0.3;
  const hasFile = Math.random() > 0.4;
  const amount = Math.random() * 5000 + 100;
  const vatRate = 0.17;
  const vatAmount = amount * vatRate;

  return {
    id,
    documentType,
    image: hasImage ? `https://picsum.photos/400/600?random=${id}` : null,
    file: hasFile ? `https://example.com/documents/doc_${id}.pdf` : null,
    amount: {
      raw: amount,
      formatted: `₪${amount.toFixed(2)}`,
      currency: Currency.Ils,
    },
    date: createDate(Math.floor(Math.random() * 90)),
    vat: {
      raw: vatAmount,
      formatted: `₪${vatAmount.toFixed(2)}`,
      currency: Currency.Ils,
    },
    serialNumber: `${Math.floor(Math.random() * 999999)}`,
    allocationNumber: Math.random() > 0.7 ? `A${Math.floor(Math.random() * 9999)}` : null,
    creditor: getRandomBusiness(),
    debtor: getRandomBusiness(),
    missingInfoSuggestions: null,
    onUpdate: () => console.log(`Updated document ${id}`),
    editDocument: () => console.log(`Edit document ${id}`),
    ...overrides,
  } as DocumentsTableRowType;
};

// Sample documents with different states
export const mockDocumentsData: DocumentsTableRowType[] = [
  // Complete invoice
  createMockDocument('1', DocumentType.Invoice),
  
  // Invoice with missing creditor (error state)
  createMockDocument('2', DocumentType.Invoice, {
    creditor: null,
  }),
  
  // Receipt with suggestions
  createMockDocument('3', DocumentType.Receipt, {
    amount: null,
    missingInfoSuggestions: {
      amount: {
        raw: 150.50,
        formatted: '₪150.50',
        currency: Currency.Ils,
      },
      isIncome: false,
      counterparty: mockBusinesses[2],
      owner: mockBusinesses[0],
    },
  }),
  
  // Unprocessed document (many errors)
  createMockDocument('4', DocumentType.Unprocessed, {
    amount: null,
    date: null,
    vat: null,
    serialNumber: null,
    creditor: null,
    debtor: null,
    image: null,
    file: null,
  }),
  
  // Credit invoice with foreign currency
  createMockDocument('5', DocumentType.CreditInvoice, {
    amount: {
      raw: -500,
      formatted: '-$500.00',
      currency: Currency.Usd,
    },
    vat: {
      raw: -85,
      formatted: '-₪85.00',
      currency: Currency.Ils,
    },
  }),
  
  // Proforma with suggestions for creditor
  createMockDocument('6', DocumentType.Proforma, {
    creditor: null,
    missingInfoSuggestions: {
      isIncome: true,
      counterparty: mockBusinesses[4],
      owner: mockBusinesses[1],
    },
  }),
  
  // Other document type
  createMockDocument('7', DocumentType.Other, {
    amount: null,
    vat: null,
    serialNumber: null,
    creditor: null,
    debtor: null,
  }),
  
  // Document with missing VAT
  createMockDocument('8', DocumentType.Invoice, {
    vat: null,
  }),
  
  // Document with missing serial number
  createMockDocument('9', DocumentType.Receipt, {
    serialNumber: null,
  }),
  
  // Document with missing date
  createMockDocument('10', DocumentType.Invoice, {
    date: null,
  }),
];

// Large dataset for testing
export const mockLargeDocumentsData: DocumentsTableRowType[] = Array.from({ length: 50 }, (_, index) => {
  const documentTypes = Object.values(DocumentType);
  const randomType = documentTypes[Math.floor(Math.random() * documentTypes.length)];
  
  return createMockDocument(`large_${index + 1}`, randomType, {
    // Random chance of missing data to show error states
    amount: Math.random() > 0.1 ? undefined : null,
    creditor: Math.random() > 0.15 ? getRandomBusiness() : null,
    debtor: Math.random() > 0.15 ? getRandomBusiness() : null,
    vat: Math.random() > 0.2 ? undefined : null,
    serialNumber: Math.random() > 0.1 ? `${Math.floor(Math.random() * 999999)}` : null,
    date: Math.random() > 0.05 ? createDate(Math.floor(Math.random() * 365)) : null,
  });
});

// Empty dataset
export const mockEmptyDocumentsData: DocumentsTableRowType[] = [];

// Single document dataset
export const mockSingleDocumentData: DocumentsTableRowType[] = [mockDocumentsData[0]];