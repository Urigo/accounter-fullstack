import { gql } from 'graphql-modules';

export default gql`
  " Result of a scraper upload mutation "
  type ScraperUploadResult {
    inserted: Int!
    skipped: Int!
    insertedIds: [String!]!
  }

  # ── Poalim ILS ──────────────────────────────────────────────────────────────

  " Input for a Poalim ILS (NIS) bank account transaction "
  input PoalimIlsTransactionInput {
    accountNumber: Int!
    activityDescription: String!
    activityDescriptionIncludeValueDate: String
    activityTypeCode: Int!
    bankNumber: Int!
    beneficiaryDetailsData: String
    beneficiaryDetailsDataMessageDetail: String
    beneficiaryDetailsDataMessageHeadline: String
    beneficiaryDetailsDataPartyHeadline: String
    beneficiaryDetailsDataPartyName: String
    beneficiaryDetailsDataRecordNumber: Int
    beneficiaryDetailsDataTableNumber: Int
    branchNumber: Int!
    comment: String
    commentExistenceSwitch: Boolean!
    contraAccountNumber: Int!
    contraAccountTypeCode: Int!
    contraBankNumber: Int!
    contraBranchNumber: Int!
    currentBalance: String!
    dataGroupCode: Int!
    details: String
    differentDateIndication: String!
    englishActionDesc: String
    eventActivityTypeCode: Int!
    eventAmount: String!
    eventDate: String!
    eventId: String!
    executingBranchNumber: Int!
    expandedEventDate: String!
    fieldDescDisplaySwitch: Boolean!
    formattedEventDate: String!
    formattedOriginalEventCreateDate: String
    formattedValueDate: String!
    internalLinkCode: Int!
    marketingOfferContext: Boolean!
    offerActivityContext: String
    originalEventCreateDate: Int!
    pfmDetails: String
    recordNumber: Int!
    referenceCatenatedNumber: Int!
    referenceNumber: String!
    rejectedDataEventPertainingIndication: String
    serialNumber: Int!
    tableNumber: Int!
    textCode: Int!
    transactionType: String!
    urlAddressNiar: String
    valueDate: String!
  }

  # ── Poalim Foreign ──────────────────────────────────────────────────────────

  " Input for a Poalim foreign currency bank account transaction "
  input PoalimForeignTransactionInput {
    accountName: String
    accountNumber: Int!
    activityDescription: String!
    activityTypeCode: Int!
    bankNumber: Int!
    branchNumber: Int!
    commentExistenceSwitch: Boolean!
    comments: String
    contraAccountFieldNameLable: String
    contraAccountNumber: Int!
    contraBankNumber: Int!
    contraBranchNumber: Int!
    contraCurrencyCode: Int!
    currency: Currency!
    currencyLongDescription: String!
    currencyRate: String!
    currencySwiftCode: String!
    currentBalance: String!
    dataGroupCode: Boolean!
    eventActivityTypeCode: Int!
    eventAmount: String!
    eventDetails: String
    eventNumber: Int!
    executingDate: String!
    formattedExecutingDate: String!
    formattedValueDate: String!
    metadataAttributesContraAccountFieldNameLable: String
    metadataAttributesContraAccountNumber: String
    metadataAttributesContraBankNumber: String
    metadataAttributesContraBranchNumber: String
    metadataAttributesContraCurrencyCode: String
    metadataAttributesCurrencyRate: String
    metadataAttributesDataGroupCode: String
    metadataAttributesOriginalEventKey: String
    metadataAttributesRateFixingCode: String
    originalEventKey: Boolean!
    originalSystemId: Int!
    rateFixingCode: Int!
    rateFixingDescription: String
    rateFixingShortDescription: String!
    referenceCatenatedNumber: Int!
    referenceNumber: Int!
    transactionType: String!
    urlAddress: String
    urlAddressNiar: String
    validityDate: String!
    valueDate: String!
  }

  # ── Poalim Swift ────────────────────────────────────────────────────────────

  " Input for a Poalim SWIFT international wire transfer "
  input PoalimSwiftTransactionInput {
    accountNumber: Int
    amount: String
    bankNumber: Int
    beneficiaryEnglishCityName: String
    beneficiaryEnglishCountryName: String
    beneficiaryEnglishStreetName: String
    branchNumber: Int
    chargePartyName: String
    currencyCodeCatenatedKey: String
    currencyLongDescription: String
    dataOriginCode: String
    formattedStartDate: String
    orderCustomerName: String
    referenceNumber: String
    startDate: String
    swiftAccountWithInstitution57: String
    swiftBankCode: String
    swiftBankOperationCode23B: String
    swiftBeneficiaryCustomer59: String
    swiftCurrencyInstructedAmount33B: String
    swiftDetailsOfCharges71A: String
    swiftExchangeRate36: String
    swiftInstructionCode23E: String
    swiftIsnSerialNumber: String
    swiftOrderingCustomer50K: String
    swiftOrderingInstitution52A: String
    swiftOrderingInstitution52D: String
    swiftReceiversCorrespondent54A: String
    swiftRegulatoryReporting77B: String
    swiftRemittanceInformation70: String
    swiftSendersCharges71F: String
    swiftSendersCorrespondent53A: String
    swiftSendersReference20: String
    swiftSendersToReceiverInformation72: String
    swiftStatusCode: String
    swiftStatusDesc: String
    swiftValueDateCurrencyAmount32A: String
    transferCatenatedId: String
  }

  # ── Isracard ────────────────────────────────────────────────────────────────

  " Input for an Isracard credit card transaction "
  input IsracardTransactionInput {
    adendum: String
    card: Int!
    cardIndex: Int!
    chargingDate: String
    city: String
    clientIpAddress: String
    currencyId: String
    currentPaymentCurrency: String
    dealSum: String
    dealSumOutbound: String
    dealSumType: String
    dealsInbound: String
    displayProperties: String
    esbServicesCall: String
    fullPaymentDate: String
    fullPurchaseDate: String
    fullPurchaseDateOutbound: String
    fullSupplierNameHeb: String
    fullSupplierNameOutbound: String
    horaatKeva: String
    isButton: String!
    isCaptcha: String!
    isError: String!
    isHoraatKeva: String!
    isShowDealsOutbound: String
    isShowLinkForSupplierDetails: String
    kodMatbeaMekori: String
    message: String
    moreInfo: String
    paymentDate: String
    paymentSum: String
    paymentSumOutbound: String
    paymentSumSign: String
    purchaseDate: String
    purchaseDateOutbound: String
    returnCode: String
    returnMessage: String
    siteName: String
    solek: String
    specificDate: String
    stage: String
    supplierId: Int
    supplierName: String
    supplierNameOutbound: String
    tablePageNum: Boolean!
    voucherNumber: Int
    voucherNumberRatz: Int
    voucherNumberRatzOutbound: Int
  }

  # ── Amex ────────────────────────────────────────────────────────────────────

  " Input for an American Express credit card transaction "
  input AmexTransactionInput {
    adendum: String
    card: Int!
    cardIndex: Int!
    chargingDate: String
    city: String
    clientIpAddress: String
    currencyId: String
    currentPaymentCurrency: String
    dealSum: String
    dealSumOutbound: String
    dealSumType: String
    dealsInbound: String
    displayProperties: String
    esbServicesCall: String
    fullPaymentDate: String
    fullPurchaseDate: String
    fullPurchaseDateOutbound: String
    fullSupplierNameHeb: String
    fullSupplierNameOutbound: String
    horaatKeva: String
    isButton: String!
    isCaptcha: String!
    isError: String!
    isHoraatKeva: String!
    isShowDealsOutbound: String
    isShowLinkForSupplierDetails: String
    kodMatbeaMekori: String
    message: String
    moreInfo: String
    paymentDate: String
    paymentSum: String
    paymentSumOutbound: String
    paymentSumSign: String
    purchaseDate: String
    purchaseDateOutbound: String
    returnCode: String
    returnMessage: String
    siteName: String
    solek: String
    specificDate: String
    stage: String
    supplierId: Int
    supplierName: String
    supplierNameOutbound: String
    tablePageNum: Boolean!
    voucherNumber: Int
    voucherNumberRatz: Int
    voucherNumberRatzOutbound: Int
  }

  # ── Cal ─────────────────────────────────────────────────────────────────────

  " Input for a Cal (Visa Cal) credit card transaction "
  input CalTransactionInput {
    amtBeforeConvAndIndex: String
    branchCodeDesc: String
    card: Int!
    cashAccountTrnAmt: String
    chargeExternalToCardComment: String
    crdExtIdNumTypeCode: String
    curPaymentNum: Int
    debCrdCurrencySymbol: String
    debCrdDate: String
    debitSpreadInd: Boolean
    earlyPaymentInd: Boolean
    isAbroadTransaction: Boolean
    isImmediateCommentInd: Boolean
    isImmediateHhkInd: Boolean
    isMargarita: Boolean
    isSpreadPaymenstAbroad: Boolean
    merchantAddress: String
    merchantId: String
    merchantName: String
    merchantPhoneNo: String
    numOfPayments: Int
    onGoingTransactionsComment: String
    refundInd: Boolean
    tokenInd: Int
    tokenNumberPart4: String
    transCardPresentInd: Boolean
    transSource: String
    trnAmt: String
    trnCurrencySymbol: String
    trnExacWay: Int
    trnIntId: String
    trnNumaretor: Int
    trnPurchaseDate: String
    trnType: String
    trnTypeCode: String
    walletProviderCode: Int
    walletProviderDesc: String
  }

  # ── Discount ────────────────────────────────────────────────────────────────

  " Input for a Discount Bank account transaction "
  input DiscountTransactionInput {
    accountNumber: String
    balanceAfterOperation: String
    branchTreasuryNumber: String
    businessDayDate: String
    categoryCode: Int
    categoryDescCode: Int
    categoryDescription: String
    channel: String
    channelName: String
    checkNumber: Int
    commissionChannelCode: String
    commissionChannelName: String
    commissionTypeName: String
    eventName: String
    instituteCode: String
    isLastSeen: Boolean
    operationAmount: String
    operationBank: Int
    operationBranch: Int
    operationCode: String
    operationDate: String
    operationDescription: String
    operationDescription2: String
    operationDescription3: String
    operationDescriptionToDisplay: String
    operationDetailsServiceName: String
    operationNumber: Int
    operationOrder: Int
    urn: String
    valueDate: String
  }

  # ── Max ─────────────────────────────────────────────────────────────────────

  " Input for a Max (formerly Leumi Card) credit card transaction "
  input MaxTransactionInput {
    actualPaymentAmount: String!
    arn: String!
    cardIndex: Int!
    categoryId: Int!
    comments: String!
    dealDataAcq: String!
    dealDataAdjustmentAmount: String
    dealDataAdjustmentType: String!
    dealDataAmount: String!
    dealDataAmountIls: String!
    dealDataAmountLeft: String!
    dealDataArn: String!
    dealDataAuthorizationNumber: String!
    dealDataCardName: String
    dealDataCardToken: String
    dealDataCommissionVat: String!
    dealDataDirectExchange: String
    dealDataExchangeCommissionAmount: String
    dealDataExchangeCommissionMaam: String
    dealDataExchangeCommissionType: String
    dealDataExchangeDirect: String!
    dealDataExchangeRate: String!
    dealDataIndexRateBase: String
    dealDataIndexRatePmt: String
    dealDataInterestAmount: String!
    dealDataIsAllowedSpreadWithBenefit: Boolean!
    dealDataIssuerCurrency: String!
    dealDataIssuerExchangeRate: String
    dealDataOriginalTerm: String
    dealDataPercentMaam: String
    dealDataPlan: String!
    dealDataPosEntryEmv: String!
    dealDataProcessingDate: String!
    dealDataPurchaseAmount: String
    dealDataPurchaseTime: String
    dealDataRefNbr: String!
    dealDataShowCancelDebit: Boolean!
    dealDataShowSpread: Boolean!
    dealDataShowSpreadBenefitButton: Boolean!
    dealDataShowSpreadButton: Boolean!
    dealDataShowSpreadForLeumi: Boolean!
    dealDataTdmCardToken: String!
    dealDataTdmTransactionType: Int!
    dealDataTransactionType: Int!
    dealDataTxnCode: Int!
    dealDataUserName: String!
    dealDataWithdrawalCommissionAmount: String
    discountKeyAmount: String
    discountKeyRecType: String
    ethocaInd: Boolean!
    fundsTransferComment: String
    fundsTransferReceiverOrTransfer: String
    isRegisterCh: Boolean!
    isSpreadingAutorizationAllowed: Boolean!
    issuerId: Int!
    merchant: String!
    merchantAddress: String
    merchantCommercialName: String
    merchantCoordinates: String
    merchantMaxPhone: Boolean!
    merchantName: String!
    merchantNumber: String!
    merchantPhone: String!
    merchantTaxId: String!
    originalAmount: String!
    originalCurrency: String!
    paymentCurrency: Int
    paymentDate: String!
    planName: String!
    planTypeId: Int!
    promotionAmount: String
    promotionClub: String!
    promotionType: String
    purchaseDate: String!
    receiptPDF: String
    refIndex: Int!
    runtimeReferenceId: String
    runtimeReferenceInternalId: String!
    runtimeReferenceType: Int!
    shortCardNumber: String
    spreadTransactionByCampainInd: Boolean!
    spreadTransactionByCampainNumber: Int
    tableType: Int!
    tag: String
    uid: String!
    upSaleForTransactionResult: String
    userIndex: Int!
  }

  # ── Currency Rates ───────────────────────────────────────────────────────────

  " Input for daily currency exchange rates "
  input CurrencyRateInput {
    exchangeDate: TimelessDate!
    aud: Float
    cad: Float
    eur: Float
    gbp: Float
    jpy: Float
    sek: Float
    usd: Float
  }

  # ── Mutations ────────────────────────────────────────────────────────────────

  extend type Mutation {
    uploadPoalimIlsTransactions(transactions: [PoalimIlsTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadPoalimForeignTransactions(
      transactions: [PoalimForeignTransactionInput!]!
    ): ScraperUploadResult! @requiresRole(role: "scraper")

    uploadPoalimSwiftTransactions(swifts: [PoalimSwiftTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadIsracardTransactions(transactions: [IsracardTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadAmexTransactions(transactions: [AmexTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadCalTransactions(transactions: [CalTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadDiscountTransactions(transactions: [DiscountTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadMaxTransactions(transactions: [MaxTransactionInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")

    uploadCurrencyRates(rates: [CurrencyRateInput!]!): ScraperUploadResult!
      @requiresRole(role: "scraper")
  }
`;
