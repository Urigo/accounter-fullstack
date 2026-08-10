import type {
  HapoalimAccountData,
  HapoalimILSTransactions,
} from '@accounter/modern-poalim-scraper';

type IlsTransaction = HapoalimILSTransactions['transactions'][number];
type AccountDataItem = HapoalimAccountData[number];

/** A complete entry from Poalim's account-list response. */
export function makePoalimAccount(
  accountNumber: number,
  branchNumber: number,
  overrides: Partial<AccountDataItem> = {},
): AccountDataItem {
  return {
    accountAgreementOpeningDate: 0,
    accountClosingReasonCode: 0,
    accountDealDate: 0,
    accountNumber,
    accountUpdateDate: 0,
    bankNumber: 12,
    branchNumber,
    branchTypeCode: 0,
    extendedBankNumber: 912,
    kodHarshaatPeilut: 1,
    metegDoarNet: 0,
    mymailEntitlementSwitch: 0,
    partyAccountInvolvementCode: 1,
    partyPreferredIndication: 0,
    productLabel: 'עובר ושב',
    serviceAuthorizationDesc: 'פעולות ומידע',
    ...overrides,
  };
}

/**
 * A complete Poalim ILS transaction. The scraper's schema requires ~40 fields, but tests only ever
 * care about a handful — pass those as overrides and let the rest stay at these defaults.
 */
export function makePoalimIlsTransaction(overrides: Partial<IlsTransaction> = {}): IlsTransaction {
  return {
    activityDescription: 'Transfer',
    activityDescriptionIncludeValueDate: null,
    activityTypeCode: 1,
    beneficiaryDetailsData: null,
    comment: null,
    commentExistenceSwitch: 0,
    contraAccountNumber: 0,
    contraAccountTypeCode: 0,
    contraBankNumber: 0,
    contraBranchNumber: 0,
    currentBalance: 5000,
    dataGroupCode: 0,
    details: null,
    differentDateIndication: 'N',
    displayCreditAccountDetails: 0,
    displayRTGSIncomingTrsDetails: 0,
    englishActionDesc: null,
    eventActivityTypeCode: 1,
    eventAmount: 100,
    eventDate: 20240101,
    eventId: 1,
    executingBranchNumber: 600,
    expandedEventDate: '20240101',
    fieldDescDisplaySwitch: 0,
    formattedCurrentBalance: '5,000.00',
    formattedEventAmount: '100.00',
    formattedEventDate: '01/01/2024',
    formattedOriginalEventCreateDate: null,
    formattedValueDate: '01/01/2024',
    internalLinkCode: 0,
    marketingOfferContext: 0,
    offerActivityContext: null,
    originalEventCreateDate: 0,
    pfmDetails: null,
    recordNumber: 0,
    referenceCatenatedNumber: 0,
    referenceNumber: 1001,
    rejectedDataEventPertainingIndication: '',
    serialNumber: 1,
    tableNumber: 0,
    textCode: 0,
    transactionType: 'REGULAR',
    valueDate: 20240101,
    ...overrides,
  };
}

export function makePoalimIlsPayload(
  accountNumber: number,
  branchNumber: number,
  transactions: Partial<IlsTransaction>[] = [{}],
): HapoalimILSTransactions {
  return {
    comments: [],
    message: [],
    numItemsPerPage: transactions.length,
    pdfUrl: '',
    retrievalTransactionData: {
      accountNumber,
      balanceAmountDisplayIndication: 'Y',
      bankNumber: 12,
      branchNumber,
      eventCounter: transactions.length,
      formattedRetrievalEndDate: '01/01/2024',
      formattedRetrievalMaxDate: '01/01/2024',
      formattedRetrievalMinDate: '01/01/2024',
      formattedRetrievalStartDate: '01/01/2024',
      joinPfm: false,
      retrievalEndDate: 20240101,
      retrievalMaxDate: 20240101,
      retrievalMinDate: 20240101,
      retrievalStartDate: 20240101,
    },
    transactions: transactions.map(makePoalimIlsTransaction),
  };
}
