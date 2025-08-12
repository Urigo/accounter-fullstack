import { z } from 'zod';

// IPv4 address regex pattern
const ipv4Pattern =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// Date patterns
const datePatternFull = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/;
const datePatternShort = /^[0-9]{2}\/[0-9]{2}$/;
const datePatternFlexible = /^[0-9]{2}\/[0-9]{2}\/([0-9]{4}|[0-9]{2})$/;

// Number patterns
const sixDigitPattern = /^[0-9]{6}$/;
const fourDigitPattern = /^[0-9]{4}$/;
const sevenDigitPattern = /^[0-9]{7}$/;
const nineDigitPattern = /^[0-9]{9}$/;

// Header schema
const HeaderSchema = z
  .object({
    ErrorPage: z.string().optional(),
    Status: z.enum(['1', '-2']),
    Message: z.null(),
  })
  .strict();

// Transaction abroad schema
const TxnAbroadSchema = z
  .object({
    EsbServicesCall: z.null(),
    adendum: z.null(),
    cardIndex: z.enum(['0', '1', '2', '3', '4', '5']),
    city: z.string().nullable(),
    clientIpAddress: z.null().optional(),
    currencyId: z.enum(['NIS', 'USD', 'EUR']).nullable(),
    currentPaymentCurrency: z
      .enum([
        'NIS',
        'USD',
        'LEU',
        'SUR',
        'EUR',
        'DKK',
        'TRY',
        'GBP',
        'CHF',
        'HUF',
        'AUD',
        'INR',
        'HKD',
        'YUN',
        'JPY',
        'SGD',
        'OMR',
        'CZE',
        'NOK',
        'THB',
        'KOR',
        'TWD',
        'CDL',
        'AUR',
        'SER',
        'PLZ',
        'CAD',
        'ISK',
      ])
      .nullable(),
    dealsInbound: z.null(),
    dealSum: z.null(),
    dealSumOutbound: z.string().nullable(),
    dealSumType: z.null(),
    displayProperties: z.null(),
    fullPaymentDate: z.string().regex(datePatternFull).nullable(),
    fullPurchaseDate: z.null(),
    fullPurchaseDateOutbound: z.string().regex(datePatternFull).nullable(),
    fullSupplierNameHeb: z.null(),
    fullSupplierNameOutbound: z.string(),
    horaatKeva: z.null(),
    isButton: z.literal('false'),
    isCaptcha: z.literal('false'),
    isError: z.literal('false'),
    isHoraatKeva: z.literal('false'),
    isShowDealsOutbound: z.enum(['_']).nullable(),
    isShowLinkForSupplierDetails: z.null(),
    message: z.null(),
    moreInfo: z.null(),
    paymentDate: z.string().regex(datePatternShort).nullable(),
    paymentSum: z.null(),
    paymentSumOutbound: z.string(),
    paymentSumSign: z.null(),
    purchaseDate: z.null(),
    purchaseDateOutbound: z.string().regex(datePatternShort).nullable(),
    returnCode: z.null(),
    returnMessage: z.null(),
    siteName: z.null(),
    solek: z.null(),
    specificDate: z.null(),
    stage: z.null(),
    supplierId: z.null(),
    supplierName: z.null(),
    supplierNameOutbound: z.string(),
    tablePageNum: z.literal('0'),
    voucherNumber: z.string().regex(sevenDigitPattern).nullable(),
    voucherNumberRatz: z.null(),
    voucherNumberRatzOutbound: z.string().regex(nineDigitPattern),
    bcKey: z.null(),
    requestNumber: z.null(),
    accountErrorCode: z.null(),
    kodMatbeaMekori: z.null(),
  })
  .strict();

// Transaction Israel schema
const TxnIsraelSchema = z
  .object({
    EsbServicesCall: z.null(),
    accountErrorCode: z.null(),
    adendum: z.null(),
    bcKey: z.null(),
    cardIndex: z.enum(['0', '1', '2', '3', '4', '5']),
    city: z.null(),
    clientIpAddress: z.null().optional(),
    currencyId: z.enum(['ש"ח', 'דולר']).nullable(),
    currentPaymentCurrency: z.null(),
    dealsInbound: z.enum(['yes', 'NO']),
    dealSum: z.string().nullable(),
    dealSumOutbound: z.null(),
    dealSumType: z.enum(['1', 'T', 'P']).nullable(),
    displayProperties: z.null(),
    fullPaymentDate: z.null(),
    fullPurchaseDate: z.string().regex(datePatternFlexible).nullable(),
    fullPurchaseDateOutbound: z.null(),
    fullSupplierNameHeb: z.string().nullable(),
    fullSupplierNameOutbound: z.null(),
    horaatKeva: z.enum(['K']).nullable(),
    isButton: z.literal('false'),
    isCaptcha: z.literal('false'),
    isError: z.literal('false'),
    isHoraatKeva: z.enum(['false', 'true']),
    isShowDealsOutbound: z.null(),
    isShowLinkForSupplierDetails: z.enum(['yes', 'NO']),
    kodMatbeaMekori: z.enum(['ש"ח', 'דולר']).nullable(),
    message: z.null(),
    moreInfo: z.string().nullable(),
    paymentDate: z.null(),
    paymentSum: z.string().nullable(),
    paymentSumOutbound: z.null(),
    paymentSumSign: z.enum(['-']).nullable(),
    purchaseDate: z.string().regex(datePatternShort).nullable(),
    purchaseDateOutbound: z.null(),
    requestNumber: z.null(),
    returnCode: z.null(),
    returnMessage: z.null(),
    siteName: z.null(),
    solek: z.enum(['I', 'L', 'V', '_', 'K', 'T']).nullable(),
    specificDate: z.null(),
    stage: z.null(),
    supplierId: z.union([z.null(), z.string().regex(sevenDigitPattern), z.literal('0')]),
    supplierName: z.string().nullable(),
    supplierNameOutbound: z.null(),
    tablePageNum: z.literal('0'),
    voucherNumber: z.string().regex(sevenDigitPattern).nullable(),
    voucherNumberRatz: z.string().regex(nineDigitPattern),
    voucherNumberRatzOutbound: z.null(),
  })
  .strict();

// Current card transactions schema
const CurrentCardTransactionsSchema = z
  .object({
    '@cardTransactions': z.string(),
    txnAbroad: z.array(TxnAbroadSchema).nullable().optional(),
    txnInfo: z.null().optional(),
    txnIsrael: z.array(TxnIsraelSchema).nullable().optional(),
  })
  .strict();

// Index schema
const IndexSchema = z
  .object({
    '@AllCards': z.literal('AllCards'),
    CurrentCardTransactions: z.array(CurrentCardTransactionsSchema),
  })
  .strict();

// Card item schema
const CardItemSchema = z
  .object({
    EsbServicesCall: z.null(),
    clientIpAddress: z.null().optional(),
    currentId: z.enum(['0', '1', '2', '3', '4', '5']).nullable(),
    displayProperties: z.null(),
    holderId: z.string().regex(nineDigitPattern),
    holderName: z.null(),
    isButton: z.literal('false'),
    isCaptcha: z.literal('false'),
    isError: z.literal('false'),
    message: z.null(),
    returnCode: z.null(),
    returnMessage: z.null(),
    siteName: z.null(),
    stage: z.null(),
    tablePageNum: z.literal('0'),
    totalDollar: z.enum(['0']).nullable(),
    totalEuro: z.enum(['0']).nullable(),
    totalNis: z.string().nullable(),
    bcKey: z.null(),
    requestNumber: z.null(),
    accountErrorCode: z.null(),
  })
  .strict();

// Card schema
const CardSchema = z.array(CardItemSchema);

// ID holder item schema
const IdHolderItemSchema = z
  .object({
    clientIpAddress: z.null().optional(),
    currentId: z.string().regex(nineDigitPattern),
    displayProperties: z.null(),
    holderId: z.null(),
    holderName: z.string(),
    isButton: z.literal('false'),
    isCaptcha: z.literal('false'),
    isError: z.literal('false'),
    message: z.null(),
    returnCode: z.null(),
    returnMessage: z.null(),
    siteName: z.null(),
    stage: z.null(),
    tablePageNum: z.literal('0'),
    totalDollar: z.string().nullable(),
    totalEuro: z.string().nullable(),
    totalNis: z.string(),
    bcKey: z.null(),
    requestNumber: z.null(),
    accountErrorCode: z.null(),
    EsbServicesCall: z.null(),
  })
  .strict();

// Cards transactions list bean schema
const CardsTransactionsListBeanSchema = z
  .object({
    EsbServicesCall: z.null(),
    card0: CardSchema,
    card6Digits: z.string().regex(sixDigitPattern),
    cardIdx: z.enum(['0,1,2,3,4,5', '0,1,2,3,4', '0,1,2,3', '0,1,2', '0,1', '0']),
    cardNumberList: z.array(z.string()),
    cardNumberTail: z.string().regex(fourDigitPattern),
    clientIpAddress: z.string().regex(ipv4Pattern).optional(),
    currentDate: z.string(),
    dateList: z.array(z.string()),
    displayProperties: z.string(),
    endDate: z.null(),
    Index0: IndexSchema,
    isButton: z.literal('false'),
    isCaptcha: z.literal('false'),
    isCashBack: z.literal('false'),
    isError: z.literal('false'),
    isShowDealsInboundForCharge: z.enum(['yes', 'NO']),
    isShowDealsInboundForInfo: z.literal('NO'),
    isThereData: z.enum(['1']).nullable(),
    isTooManyRecords: z.null(),
    message: z.null(),
    moed: z.string().regex(sixDigitPattern),
    month: z.enum(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']),
    payDay: z.enum(['10', '02', '15']).nullable(),
    paymentPercent: z.null(),
    paymentSum: z.enum(['000', '280']),
    returnCode: z.null(),
    returnMessage: z.null(),
    selectedCardIndex: z.enum(['0', '1', '2', '3', '4', '5']),
    selectedCardInfo: z.string(),
    selectedDateIndex: z.enum(['23', '24']),
    siteName: z.null(),
    specificDate: z.null(),
    stage: z.null(),
    startDate: z.null(),
    tablePageNum: z.literal('0'),
    totalChargeDollar: z.null(),
    totalChargeEuro: z.null(),
    totalChargeNis: z.string().nullable(),
    totalDebit: z.null(),
    userId: z.string().regex(nineDigitPattern),
    year: z.enum([
      '2010',
      '2011',
      '2012',
      '2013',
      '2014',
      '2015',
      '2016',
      '2017',
      '2018',
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
    ]),
    bcKey: z.null(),
    requestNumber: z.null(),
    accountErrorCode: z.null(),
  })
  .strict()
  .catchall(
    z.union([
      // Index patterns: Index0, Index1, Index2, etc.
      IndexSchema,
      // ID patterns: id123456789 (9-digit ID)
      z.array(IdHolderItemSchema),
      // Card patterns: card0, card1, card2, etc.
      CardSchema,
    ]),
  );

// Main schema
export const IsracardCardsTransactionsListSchema = z
  .object({
    Header: HeaderSchema,
    CardsTransactionsListBean: CardsTransactionsListBeanSchema,
  })
  .strict();

export type IsracardCardsTransactionsList = z.infer<typeof IsracardCardsTransactionsListSchema>;
