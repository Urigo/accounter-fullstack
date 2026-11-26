import { z } from 'zod';

/**
 * Schemas for Bank Leumi's own JSON APIs, written from live responses.
 *
 * Objects are `.strict()`: a key the bank adds makes validation fail, so a change in what
 * Leumi sends is noticed instead of silently dropped.
 *
 * `neverObserved` marks a field that only ever came back `null` in the accounts these
 * schemas were written against. It accepts `null` alone on purpose: the first account that
 * has a value there fails validation, which is the signal to give the field a real type.
 * Likewise `z.array(z.never())` is a list that was only ever seen empty.
 */
const neverObserved = z.null();

/** `2026-11-23T22:00:00.002Z` — midnight in Israel, expressed in UTC. */
const isoUtcDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
/** `2026-12-01T00:00:00` — no zone. */
const isoLocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
/** `2026-11-24T02:00:00+02:00` */
const isoOffsetDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
/** `2021-05-15` */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** `24/11/2026` */
const slashDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/);
/** `15.04.46` — day.month.two-digit year */
const dotShortDate = z.string().regex(/^\d{2}\.\d{2}\.\d{2}$/);
/** `11.2026` */
const monthYear = z.string().regex(/^\d{2}\.\d{4}$/);
const digits = z.string().regex(/^\d+$/);

/**
 * Status block every `Broker.svc` module returns. `Status: false` is a failed call;
 * `Status: true` with a `NO DATA` item is an empty but successful one.
 */
export const soStatusSchema = z
  .object({
    Status: z.boolean(),
    SOStatusItem: z
      .array(
        z
          .object({
            Code: z.number(),
            Message: z.string(),
            ResourceID: z.string(),
            GlobalResourceID: z.string().nullable(),
          })
          .strict(),
      )
      .nullable(),
  })
  .strict();

export const getAccountsResponseSchema = z
  .object({
    AccountsItems: z.array(
      z
        .object({
          AccountIndex: z.number(),
          Type: z.string(),
          MaskedClientNumber: z.string(),
          MaskedNumber: z.string(),
          ExtAccountPermissions: z.string(),
          MaskedParentForeignAccountNumber: z.string(),
          CurrencyCode: z.string(),
          AccountIndications: z.string(),
          ClientProd: z.string(),
          CorporateName: z.string(),
          DisplayName: neverObserved,
        })
        .strict(),
    ),
    SOStatus: soStatusSchema,
  })
  .strict();

export const allAccountsResponseSchema = z
  .object({
    RequestsItems: z.array(
      z
        .object({
          requestType: z.number(),
          requestDescription: z.string(),
          comboActualMethod: z.boolean(),
          AccountsItems: z.array(
            z
              .object({
                accountIndex: z.number(),
                balanceIncludingToday: z.number().nullable(),
                type: z.string(),
                maskedClientNumber: z.string().nullable(),
                isDefaultClientNumber: z.boolean(),
                maskedNumber: z.string().nullable(),
                number: digits.nullable(),
                maskedNumberMonitoring: z.string().nullable(),
                friendlyAccountName: neverObserved,
                extAccountPermissions: z.string(),
                maskedParentForeignAccNumber: z.string().nullable(),
                currencyCode: digits.nullable(),
                clientProd: z.string().nullable(),
                corporateName: z.string(),
                friendlyIcon: neverObserved,
                nameForDisplay: z.string(),
                leumiMailFlag: z.boolean().nullable(),
                clientNumber: digits,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export const summaryDataResponseSchema = z
  .object({
    asOfDateDisplayUTC: dotShortDate,
    totalPerClientPositive: z.number(),
    totalPerClientNegative: z.number(),
    personalIDNumber: digits,
    totalMortgageDisplay: z.number(),
    mortgageAsOfDateDisplayUTC: isoUtcDateTime,
    multiCheckingFlag: z.boolean(),
    mortgageFXFlag: z.boolean(),
    mortgagePositiveFlag: z.boolean(),
    TotalPerTypeItems: z.array(
      z
        .object({
          accountType: z.string(),
          totalPerAccountType: z.number(),
          exchangeRateDate: dotShortDate.nullable(),
        })
        .strict(),
    ),
    securitiesDataItems: neverObserved,
  })
  .strict();

export const ilsTransactionSchema = z
  .object({
    DateUTC: isoUtcDateTime,
    DateSO: slashDate,
    Amount: z.number(),
    Credit: z.number(),
    Debit: z.number(),
    TransactionSign: z.boolean(),
    Description: z.string(),
    RunningBalance: z.number(),
    EffectiveDateUTC: isoUtcDateTime,
    EffectiveDateSO: slashDate,
    ReferenceNumberLong: z.number(),
    TypeInt: z.number(),
    AdditionalDescriptionIdentifier: z.boolean(),
    AdditionalData: z.string().nullable(),
    AdditionalActivityTypeInt: z.number(),
    SegmentationFlagInt: z.number(),
    ExtensionTypeCode: z.number(),
    CreditCardIndex: z.number(),
    Period: z.number(),
    IfLinkInt: z.number(),
    InvoiceStatus: neverObserved,
    CheckNumberLong: z.number(),
    FITID: digits,
    TrxIndex: z.number(),
  })
  .strict();
export const ilsTransactionsResponseSchema = z
  .object({
    UserPreferenceItems: z.array(
      z
        .object({
          TrxSortOrder: z.boolean(),
          ExpandTrx: z.boolean(),
          DisplayDate: z.boolean(),
          DisplayValueDate: z.boolean(),
          DisplayDesc: z.boolean(),
          DisplayReference: z.boolean(),
          DisplayDebit: z.boolean(),
          DisplayCredit: z.boolean(),
          DisplayBalance: z.boolean(),
          DisplayInvoice: z.boolean(),
        })
        .strict(),
    ),
    HistoryTransactionsItems: z.array(ilsTransactionSchema),
    TodayTransactionsItems: z.array(ilsTransactionSchema).nullable(),
    SOStatus: soStatusSchema,
    TodayFlag: z.boolean(),
    BalanceDisplay: z.number(),
    BalanceIncludingToday: z.number(),
    BalanceDelays: z.number(),
    BalanceIncludingDelays: z.number(),
    TotalCredit: z.number(),
    AsOfDateUTC: isoUtcDateTime,
    RequestType: z.string(),
  })
  .strict();

export const creditCardsInfoResponseSchema = z
  .object({
    SOStatus: soStatusSchema,
    CreditCardsItems: z.array(
      z
        .object({
          CreditCardCompanyCode: digits,
          RelatedAccountNumber: digits,
          CardLast4Digits: digits,
          DisplayName: z.string(),
          DisplayNameEnglish: neverObserved,
          CardHolderNameHebrew: z.string(),
          CardHolderNameEnglish: z.string(),
          CurrentBalance: z.number(),
          DatePaymentDueUTC: isoUtcDateTime,
          AsOfDateUTC: isoUtcDateTime,
          LastDebitSumSpecified: z.boolean(),
          DatePaymentLastUTC: isoUtcDateTime,
          PreviousDebitSumSpecified: z.boolean(),
          PreviousDatePaymentDueUTC: isoUtcDateTime,
          CardImg: z.string(),
          CardTypeDesc: z.string(),
          IndicationClub: z.number(),
          CardIndex: z.number(),
          RowIndex: z.number(),
          TypeHebrowName: z.string(),
          BlockCardStatus: z.number(),
          BlockCardStatusSpecified: z.boolean(),
          CreditcardActionsItems: z.array(
            z
              .object({
                CreditCardActionID: z.number(),
                CreditCardActionDescription: digits,
                UrlCard: neverObserved,
                IsExternalLink: z.boolean(),
              })
              .strict(),
          ),
          NextDebitEURO: z.number(),
          NextDebitEUROSpecified: z.boolean(),
          NextDebitUSD: z.number(),
          NextDebitUSDSpecified: z.boolean(),
        })
        .strict(),
    ),
    CashCardsItems: z.array(z.never()),
    OtherCreditCardsItems: z.array(
      z
        .object({
          RelatedAccountNumber: digits,
          CreditCardCompanyCode: digits,
          CardLast4Digits: digits,
          DisplayName: z.string(),
          DisplayNameEnglish: neverObserved,
          CardHolderNameHebrew: z.string(),
          CardHolderNameEnglish: z.string(),
          CurrentBalance: z.number(),
          DatePaymentDueUTC: isoUtcDateTime,
          AsOfDateUTC: isoUtcDateTime,
          LastDebitSumSpecified: z.boolean(),
          DatePaymentLastUTC: isoUtcDateTime,
          PreviousDebitSumSpecified: z.boolean(),
          DatePaymentPreviousUTC: neverObserved,
          CardImg: z.string(),
          CardTypeDesc: z.string(),
          CardIndex: z.number(),
          RowIndex: z.number(),
          TypeHebrowName: z.string(),
          CreditcardActionsItems: z.array(
            z
              .object({
                CreditCardActionID: z.number(),
                CreditCardActionDescription: digits,
                UrlCard: neverObserved,
                IsExternalLink: z.boolean(),
              })
              .strict(),
          ),
          NextDebitEURO: z.number(),
          NextDebitEUROSpecified: z.boolean(),
          NextDebitUSD: z.number(),
          NextDebitUSDSpecified: z.boolean(),
        })
        .strict(),
    ),
    DebitCardsItems: z.array(z.never()),
    OtherCreditCardStatus: neverObserved,
    DisplayExcelExportLink: z.number(),
    PilotFlag: z.boolean(),
    PilotFlagSpecified: z.boolean(),
  })
  .strict();

export const creditCardNisTransactionSchema = z
  .object({
    DateDealUTC: isoUtcDateTime,
    AmountDouble: z.number(),
    DebitCardFirmName: z.string(),
    TransactionCurrency: z.string(),
    TypeOfTransaction: z.number(),
    DealDescription: z.string(),
    NextPaymentAmountDouble: z.number(),
    NextPaymentAmountDoubleSpecified: z.boolean(),
    CardTransactionId: z.string(),
    DebitCardDebitPeriodUTC: isoUtcDateTime,
  })
  .strict();

export const creditCardForeignTransactionSchema = z
  .object({
    DateDealUTC: isoUtcDateTime,
    DebitCardFirmName: z.string(),
    AmountDouble: z.number(),
    DebitedAccountNumber: digits,
    DebitCardDebitPeriodUTC: isoUtcDateTime,
    TypeOfTransaction: z.number(),
    DealDescription: z.string(),
    NextPaymentAmountDouble: z.number(),
    NextPaymentAmountDoubleSpecified: z.boolean(),
    TransactionCurrency: digits,
    PaymentCurrency: digits,
    CardTransactionId: z.string(),
  })
  .strict();
export const creditCardDetailsResponseSchema = z
  .object({
    SOStatus: soStatusSchema,
    DisplayRealTimeTransactionsFlag: z.boolean(),
    TotalPayment: z
      .object({
        TotalBalance: z.number(),
        TotalBalanceSpecified: z.boolean(),
        TotalBalanceOtherCreditcard: z.number(),
        TotalBalanceOtherCreditcardSpecified: z.boolean(),
        CreditCardCoinsNODSpecified: z.boolean(),
        IndicationClubIntSpecified: z.boolean(),
        CreditCardCoinsStatus: neverObserved,
        NeverMinusFlag: z.boolean(),
        NeverMinusFlagSpecified: z.boolean(),
        TotalIndependentAndCommonCreditD: z.number(),
        TotalIndependentAndCommonCreditDSpecified: z.boolean(),
        TotalUsageD: z.number(),
        TotalUsageDSpecified: z.boolean(),
        LeftToUseD: z.number(),
        LeftToUseDSpecified: z.boolean(),
        TotalPercentageD: z.number(),
        TotalPercentageDSpecified: z.boolean(),
        LimitExceededFlag: z.number(),
        LimitExceededFlagSpecified: z.boolean(),
        IsThereCreditcard: z.boolean(),
        IsThereCreditcardSpecified: z.boolean(),
        IsThereOtherCreditcard: z.boolean(),
        IsThereOtherCreditcardSpecified: z.boolean(),
        NextDebitUSD: z.number(),
        NextDebitUSDSpecified: z.boolean(),
        NextDebitEURO: z.number(),
        NextDebitEUROSpecified: z.boolean(),
        DatePaymentDueUTC: isoUtcDateTime,
        CardTotalItems: z.array(
          z
            .object({
              CurrencyCode: digits,
              ForeignAccountIndication: z.boolean(),
              ForeignAccountIndicationSpecified: z.boolean(),
              DisplayAirlinePoints: z.boolean(),
              ValidDateCreditcardUTC: isoUtcDateTime,
              CardLast4Digits: digits,
              AirlineClubIndication: digits,
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    Graph: z
      .object({
        DatePaymentItems: z.array(
          z
            .object({
              DebitSum: z.number(),
              DebitSumSpecified: z.boolean(),
              Currency: digits,
              CardPeriodType: z.number(),
              PaymentDateUTC: isoUtcDateTime,
              DateMonthText: digits,
            })
            .strict(),
        ),
        MultiData: z
          .object({
            MultiCardFlag: digits,
            FixedPaymentMulti: z.number(),
            TotalAmountMulti: z.number(),
            PreviousAmountMulti: z.number(),
            NextMonthAmountMulti: z.number(),
          })
          .strict()
          .nullable(),
        DebitMonthItems: z.array(
          z
            .object({
              CycleDate: isoLocalDateTime,
              CycleMonth: digits,
              CycleYear: z.number(),
              DefaultMonth: z.boolean(),
              FinalOrPandingFlag: z.number(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    Activity: z
      .object({
        TabNisTransactionItems: z.array(
          z
            .object({
              TableID: z.number(),
              NisTransactionItems: z.array(creditCardNisTransactionSchema),
              TotalAmountDouble: z.number(),
            })
            .strict(),
        ),
        TabForeignTransactionItems: z.array(
          z
            .object({
              TableID: z.number(),
              CardMaskedNumber: z.string(),
              Currency: digits,
              ForeignTransactionItems: z.array(creditCardForeignTransactionSchema),
              TotalAmountDouble: z.number(),
              TotalAmountDoubleSpecified: z.boolean(),
            })
            .strict(),
        ),
        RealTimeTransItems: neverObserved,
        LastUpdateUTC: isoUtcDateTime,
      })
      .strict()
      .nullable(),
    PayBack: z
      .object({
        CardDebitDateUTC: neverObserved,
        PaymentAmountDouble: z.number(),
        PaymentAmountDoubleSpecified: z.boolean(),
        CardFee: z.number(),
        CardFeeSpecified: z.boolean(),
        CardFeeAfterDiscountSpecified: z.boolean(),
        DiscountAmount: z.number(),
        DiscountAmountSpecified: z.boolean(),
        DiscountPercentage: z.number(),
        DiscountPercentageSpecified: z.boolean(),
        Club: z.string(),
        FullPaybackAmount: z.number(),
        FullPaybackAmountSpecified: z.boolean(),
        MaxDiscountPercentSpecified: z.boolean(),
        PaybackEntitlement: z.number(),
        PaybackEntitlementSpecified: z.boolean(),
        PaybackDetailsFlag: neverObserved,
      })
      .strict()
      .nullable(),
    CreditLineTab: neverObserved,
    CardIndex: z.number(),
  })
  .strict();

export const creditCardLinesResponseSchema = z
  .object({
    totalCreditLimit: z.number(),
    totalUsageBalance: z.number(),
    totalCreditLimitMax: z.number(),
    totalCreditLimitCal: neverObserved,
    totalCreditLimitIsracard: neverObserved,
    totalUnusedAmountMax: z.number(),
    totalUnusedAmountCal: neverObserved,
    totalUnusedAmountIsracard: neverObserved,
    cardItems: z.array(
      z
        .object({
          cardIndex: z.number(),
          cardLast4Digits: digits,
          cardType: z.number(),
          totalCardUnusedAmount: z.number(),
          creditLine: z.number(),
          operatingCompany: z.string(),
          cardNetwork: z.string(),
          fixedPaymentMulti: z.number(),
          previousAmountMulti: z.number(),
          totalCardUsageAmount: z.number(),
          creditLineType: z.number(),
          multiCurrencyIndication: z.boolean(),
          currencyCode: z.string(),
          cardStatus: z.number(),
          airlineClubIndication: z.number(),
          cardExpiryDate: isoLocalDateTime,
        })
        .strict(),
    ),
  })
  .strict();

export const mortgageDetailsResponseSchema = z
  .object({
    clearingBalanceAll: z.number(),
    partyLIdRef: digits,
    loanMortgageItems: z.array(
      z
        .object({
          MortgageDetail: z
            .object({
              mortgageKey: digits,
              mortgageKeyFormatted: z.string(),
              source: digits,
              dayOfPayment: z.number(),
              clearingBalance: z.number(),
              currencyLeumi: digits,
              clearingCommission: z.number(),
              interestBalance: z.number(),
              arrearsTotalAmount: z.number(),
              interestPredicted: z.number(),
              interestForCompare: z.number(),
              additionalPaymentsAmount: z.number(),
              mortgageAmount: z.number(),
              bookingDate: dotShortDate,
              mortgagePurpose: z.string(),
              lastPaymentAmount: z.number(),
              mortgageEndDate: dotShortDate,
              linkToPDF6541: z.string(),
              portfolioAccountsItems: z.array(
                z
                  .object({
                    portfolioAccountNum: z.string(),
                  })
                  .strict(),
              ),
              loanItems: z.array(
                z
                  .object({
                    loanID: digits,
                    externalLoanId: digits,
                    loanStatus: z.string(),
                  })
                  .strict(),
              ),
              balanceItems: z.array(
                z
                  .object({
                    operationalCommission: z.number(),
                    clearingBalance: z.number(),
                    validityDate: isoLocalDateTime,
                    fundBalance: z.number(),
                    linkageEstimatedBalance: z.number(),
                  })
                  .strict(),
              ),
              partnerDetailsItems: z.array(
                z
                  .object({
                    partnerName: z.string(),
                    roleInPartnership: z.string(),
                  })
                  .strict(),
              ),
              address: z.string(),
              mortgageOperationsItems: z.array(
                z
                  .object({
                    actionId: z.number(),
                    actionResourceKey: z.string(),
                  })
                  .strict(),
              ),
            })
            .strict(),
        })
        .strict(),
    ),
  })
  .strict();

export const mortgageLoanInfoResponseSchema = z
  .object({
    MortgageDetails: z
      .object({
        mortgageKey: digits,
        mortgageKeyFormatted: z.string(),
        originalEndDateCalc: dotShortDate,
        loansItems: z.array(
          z
            .object({
              productName: z.string(),
              loanId: digits,
              annualInterestPercent: z.number(),
              lastPaymentAmount: z.number(),
              currencyLeumi: digits,
              clearingTableDescription: z.string(),
              commissionFreeBalance: z.number().nullable(),
              loanCreditDate: dotShortDate.nullable(),
              calculateEndDate: dotShortDate,
              clearingBalance: z.number().nullable(),
              interestBalance: neverObserved,
              interestPredicted: z.number().nullable(),
              interestForCompare: z.number().nullable(),
              adjustedInterest: z.number(),
              failureToReportCommission: z.number().nullable(),
              fundBalance: z.number().nullable(),
              linkageEstimatedBalance: z.number().nullable(),
              dailyInterest: neverObserved,
              loanAmount: z.number(),
              originalEndDate: dotShortDate,
              annualOriginalInterestPercent: z.number(),
              anchorSpreadRate: z.string().nullable(),
              calculatedAnnualInterest: z.string(),
              percentChgDate: neverObserved,
              linkageBase: z.string(),
              clearingCommission: z.number().nullable(),
              baseLinkageIndexValue: z.number(),
              interestType: z.string(),
              currentAnchor: z.number().nullable(),
              frequencyOfInterestChange: z.string().nullable(),
              averageIndexCommission: neverObserved,
              capitalizationCommission: z.number(),
              loanFirstPayDate: isoDate,
              loanTypeDesc: z.string(),
              mortgageDisclaimer: z.string(),
              paymentItems: z.array(
                z
                  .object({
                    paymentDate: monthYear,
                    paymentAmount: z.number(),
                    currencyLeumi: digits,
                  })
                  .strict(),
              ),
              partnerDetailsItems: z.array(z.never()),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export const mortgageDataResponseSchema = z
  .object({
    personalIDNumber: digits,
    asOfDateDisplayUTC: isoUtcDateTime,
    totalMortgageNIS: z.number(),
    totalLastPaymentNIS: z.number(),
    totalMortgageUSD: neverObserved,
    totalUSDMortgageNIS: neverObserved,
    totalLastPaymentUSD: neverObserved,
    totalMortgageEuro: neverObserved,
    totalEuroMortgageNIS: neverObserved,
    totalLastPaymentEuro: neverObserved,
    mortgageDataItems: z.array(
      z
        .object({
          accountIndex: z.number(),
          displayName: neverObserved,
          maskedNumber: z.string(),
          mortgageKeyIndex: digits,
          disposalBalanceNoCommission: z.number(),
          asOfDateUTC: isoOffsetDateTime,
          currencyCode: digits,
          disposalBalanceNoCommissionNIS: z.number(),
          initialLoanDateUTC: isoUtcDateTime,
          terminationDateUTC: isoUtcDateTime,
          lastPaymentAmount: z.number(),
          disposalBalance: z.number(),
          disposalBalanceNIS: z.number(),
        })
        .strict(),
    ),
  })
  .strict();

export const savingCdDataResponseSchema = z
  .object({
    asOfDateDisplayFXUTC: neverObserved,
    asOfDateDisplayNISUTC: neverObserved,
    totalCurrentBalanceFX: neverObserved,
    totalCurrentBalanceNIS: neverObserved,
    cDFXDataItems: neverObserved,
    cDNISDataItems: neverObserved,
  })
  .strict();

export const marketProductDetailsResponseSchema = z
  .object({
    deeplinkLeumiMoneyProducts: z.string(),
    deeplinkLeumiTrade: z.string(),
    depositsItems: z.object({}).strict(),
    moneyMarketFundsItems: z.object({}).strict(),
    governmentBondItems: z.object({}).strict(),
  })
  .strict();

export const tradeConfigResponseSchema = z
  .object({
    data: z
      .object({
        user: z
          .object({
            megaTraderIsr: z.boolean(),
            megaTraderUsa: z.boolean(),
            streamerIsr: z.boolean(),
            streamerUsa: z.boolean(),
            usaRealTimeSigned: z.boolean(),
            userTimeout: z.number(),
            streamerServerUrl: z.string(),
            lastLoginTime: z.string(),
            userType: z.number(),
            Portfolios: z.array(z.never()),
            isNeedPrivacyPolicyApproval: z.boolean(),
            isBusiness: z.boolean(),
            SalesForceEnabled: z.boolean(),
            ShowBWonMarketsPage: z.boolean(),
            AllowSF2: z.boolean(),
            ForeignBalanceEnabled: z.boolean(),
            UseReturnsFile: z.boolean(),
            Clients: z.array(
              z
                .object({
                  Bank: z.number(),
                  Branch: z.number(),
                  BranchName: z.string(),
                  ClientNumber: z.number(),
                  CorporationLtd: digits,
                  CharacterAttributes: digits,
                  TrustAccount: digits,
                  CustomerDivision: digits,
                  InvolvementType: z.number(),
                  SignatureOnSecurities: z.boolean(),
                  ClientCanOpenDepositDigitaly: z.boolean(),
                  PrivateMati: z.array(
                    z
                      .object({
                        Branch: z.number(),
                        Account: z.number(),
                        Name: z.string(),
                        PortfolioId: digits,
                        Nickname: neverObserved,
                      })
                      .strict(),
                  ),
                })
                .strict(),
            ),
            IsShowTutorial: z.boolean(),
            IsShowVideo: z.boolean(),
            personalIdNumber: digits,
            englishFirstUserName: z.string(),
            englishLastUserName: z.string(),
            hebrewFirstUserName: z.string(),
            hebrewLastUserName: z.string(),
            birthDate: z.string(),
            guid: z.string(),
            userCanNasdaqProfessional: z.boolean(),
            userCanAssignNasdaq: z.boolean(),
            userCanOpenDepositDigitally: z.boolean(),
            displayDepositOpeningMenu: z.boolean(),
            displayDepositSettingsMenu: z.boolean(),
            userCanAssignCrypto: z.boolean(),
            userCanUsaOptions: z.boolean(),
            loginState: z.string(),
            Gdpr: z.boolean(),
            isConsultant: z.boolean(),
            isMabatRegister: z.boolean(),
            isShowConsultWorld: z.boolean(),
            MisparManuy: digits,
            DefaultIndex: neverObserved,
            LocalKey: z.string(),
            SessionKey: z.string(),
            PreAfterSign: z.number(),
            PreAfterVer: z.number(),
            PreAfterSignNewVersionAvailable: z.boolean(),
            isIgud: z.boolean(),
            companyEventsSupport: z.boolean(),
            mabatForClientSupport: z.boolean(),
            mabatForClientMdaSupport: z.boolean(),
            mabatForClientHybridSupport: z.boolean(),
            preAfterSupport: z.boolean(),
            isNoLimitationOpenNewPortfolio: z.boolean(),
            cryptoSupport: z.boolean(),
            cryptoSignState: z.number(),
            IsPrivateBank: z.boolean(),
            gtoDataProvider: z.boolean(),
            gtoErData: z.boolean(),
            gtoDataSearch: z.boolean(),
            gtoUSAMarket: z.boolean(),
            gtoEUMarket: z.boolean(),
            gtoMomentum: z.boolean(),
            gtoGraph: z.boolean(),
            gtoNews: z.boolean(),
            showUserAfterTradeUnregisteredPopup: z.boolean(),
            gtoForeighPaperDetail: z.boolean(),
            bridgewiseEms: z.boolean(),
            gtoBusinessCard: z.boolean(),
            gtoUserConnection: z.boolean(),
            isL1L2: z.boolean(),
            isMarketsPilot: z.boolean(),
            referOldOpenDeposit: z.boolean(),
            isUsaOptionsApp: z.boolean(),
            isAutotradeForeignApp: z.boolean(),
            isListedSecurityApp: z.boolean(),
            isFundApp: z.boolean(),
            isHedgeFundApp: z.boolean(),
            IsMonetaryFundApp: z.boolean(),
            isMaofApp: z.boolean(),
            isStandingEnableApp: z.boolean(),
            isAutotradeIsraelApp: z.boolean(),
            isIcebergApp: z.boolean(),
            isNewPortfolioV2: z.boolean(),
            isTradeIsraelApp: z.boolean(),
            isTradeForeignApp: z.boolean(),
            isExposureValue: z.boolean(),
            IsPepper: z.boolean(),
            hedgeFundSupport: z.boolean(),
            monetaryFundSupport: z.boolean(),
            appNewSearchSupport: z.boolean(),
            stmCurrencyRelative: z.boolean(),
            BllCurrencyList: z.array(
              z
                .object({
                  Id: z.number(),
                  CurrencyName: z.string(),
                  CurrencyNameEng: z.string(),
                  CurrencyACode: z.string(),
                  CurrencySymbol: z.string(),
                  CurrencyNameEngAlt: neverObserved,
                })
                .strict(),
            ),
            CryptoState: z.number(),
            rtIsraelL1L2Signed: z.number(),
            canSignL2: z.boolean(),
            showL1L2Popup: z.boolean(),
            clientMaxPortfolios: z.number(),
            displayUserMaximumPortfoliosError: z.boolean(),
            userName: z.string(),
            userAlias: z.string(),
          })
          .strict(),
        settings: z
          .object({
            imageServerUrl: z.string(),
            logosServerUrl: z.string(),
            apiServerUrl: z.string(),
            cacheServerRoot: z.string(),
            isApplication: z.boolean(),
            UrlDownloadApplicationIOS: z.string(),
            UrlDownloadApplicationAndroid: z.string(),
            CochavDisplayDepositsAndSavingslinkApp: z.string(),
            UrlLeumiAdviceTutorial: z.string(),
            BankerChatLink: z.string(),
            UsePaxWebSocket: z.boolean(),
            IsViewReportsBtn: z.boolean(),
            UrlPaxWebSocket: z.string(),
            ServerId: z.string(),
            Build: z.string(),
            bullsScreenerEuropa: z.string(),
            accessibilityJSSrc: z.string(),
            clarisiteJSSrc: z.string(),
            clarisiteReportJSSrc: z.string(),
            unsecuredSiteRoot: z.string(),
            oldSecuredSiteRoot: z.string(),
            tradeModeAfterDisable: z.boolean(),
            tradeModeAfterRegistrationEnable: z.boolean(),
            badgeNewIds: z.array(z.string()),
            customMsgIds: z
              .object({
                RetPrivateNotAdvised: z.string(),
                RetPrivateAdvised: z.string(),
                RetNonPrivateAdvised: z.string(),
              })
              .strict(),
            helpQuestionsCategoryCode: z.number(),
            LastTradeDate: z
              .object({
                Current: isoDate,
                Paper: isoDate,
                Kranot: isoDate,
              })
              .strict(),
            trade_time_isr: z
              .object({
                start: z.string(),
                end: z.string(),
              })
              .strict(),
            tipranks: z
              .object({
                tipranks_url: z.string(),
                details_url: z.string(),
                ratings_url: z.string(),
              })
              .strict(),
            bursa_graph: z
              .object({
                bg_url: z.string(),
                bg_token: z.string(),
              })
              .strict(),
            ChatBridgewise: z.boolean(),
            ChatBridgewiseNew: z.boolean(),
            IsShowTALDisclaimer: z.boolean(),
            show_sso_alert: z.boolean(),
            show_bursa_graph: z.boolean(),
            banker_service: z.string(),
            nabat_bd_pdf_url: z.string(),
          })
          .strict(),
        countries: z.array(
          z
            .object({
              country_id: z.number(),
              name_he: z.string(),
              name_en: z.string(),
              week: z.array(
                z
                  .object({
                    day: z.number(),
                    time_begin: z.string(),
                    time_end: z.string(),
                    time_isr_begin: z.string(),
                    time_isr_end: z.string(),
                    AxisTime: z.array(z.string()),
                    AxisTimeIsrael: z.array(z.string()),
                  })
                  .strict(),
              ),
              remark: neverObserved,
            })
            .strict(),
        ),
        cfgElapsed: z.number(),
      })
      .strict(),
    resultCode: z.number(),
    rsCount: z.number(),
    rtIsr: z.boolean(),
    rtUsa: z.boolean(),
    logtm: z.number(),
    reqtm: z.number(),
    responsetm: z.string(),
    serverId: z.string(),
    version: z.string(),
  })
  .strict();
