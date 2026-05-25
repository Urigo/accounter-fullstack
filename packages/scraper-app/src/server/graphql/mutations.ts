import type {
  HapoalimForeignTransactionsBusiness,
  HapoalimForeignTransactionsPersonal,
  HapoalimILSTransactions,
  IsracardCardsTransactionsList,
} from '@accounter/modern-poalim-scraper';
import {
  IsracardTransactionInput,
  MutationUploadAmexTransactionsArgs,
  MutationUploadIsracardTransactionsArgs,
  MutationUploadOtsarHahayalCreditCardTransactionsArgs,
  MutationUploadOtsarHahayalForeignTransactionsArgs,
  MutationUploadOtsarHahayalIlsTransactionsArgs,
  UploadPoalimForeignTransactionsMutationVariables,
  UploadPoalimIlsTransactionsMutationVariables,
  UploadPoalimSwiftTransactionsMutationVariables,
} from '../gql/index.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import type { CurrencyRatesPayload } from '../payload-schemas/currency-rates.schema.js';
import type { DiscountPayload } from '../payload-schemas/discount.schema.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import type {
  ForeignAccountData,
  OtsarHahayalCreditCardData,
  OtsarHahayalIlsData,
} from '../scrapers/otsar-hahayal.js';
import { DecoratedSwiftTransactions } from '../scrapers/poalim.js';
import {
  convertNumberDateToString,
  convertPoalimCurrencyCodeToSymbol,
  findPoalimSwiftElement,
} from '../utils.js';

// ── Mutation document strings ──────────────────────────────────────────────────

export const UPLOAD_POALIM_ILS = /* GraphQL */ `
  mutation UploadPoalimIlsTransactions($transactions: [PoalimIlsTransactionInput!]!) {
    uploadPoalimIlsTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_POALIM_FOREIGN = /* GraphQL */ `
  mutation UploadPoalimForeignTransactions($transactions: [PoalimForeignTransactionInput!]!) {
    uploadPoalimForeignTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_POALIM_SWIFT = /* GraphQL */ `
  mutation UploadPoalimSwiftTransactions($swifts: [PoalimSwiftTransactionInput!]!) {
    uploadPoalimSwiftTransactions(swifts: $swifts) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_ISRACARD = /* GraphQL */ `
  mutation UploadIsracardTransactions($transactions: [IsracardTransactionInput!]!) {
    uploadIsracardTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_AMEX = /* GraphQL */ `
  mutation UploadAmexTransactions($transactions: [AmexTransactionInput!]!) {
    uploadAmexTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_CAL = /* GraphQL */ `
  mutation UploadCalTransactions($transactions: [CalTransactionInput!]!) {
    uploadCalTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_DISCOUNT = /* GraphQL */ `
  mutation UploadDiscountTransactions($transactions: [DiscountTransactionInput!]!) {
    uploadDiscountTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_MAX = /* GraphQL */ `
  mutation UploadMaxTransactions($transactions: [MaxTransactionInput!]!) {
    uploadMaxTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_CURRENCY_RATES = /* GraphQL */ `
  mutation UploadCurrencyRates($rates: [CurrencyRateInput!]!) {
    uploadCurrencyRates(rates: $rates) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_OTSAR_ILS = /* GraphQL */ `
  mutation UploadOtsarHahayalIlsTransactions($transactions: [OtsarHahayalIlsTransactionInput!]!) {
    uploadOtsarHahayalIlsTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_OTSAR_FOREIGN = /* GraphQL */ `
  mutation UploadOtsarHahayalForeignTransactions(
    $transactions: [OtsarHahayalForeignTransactionInput!]!
  ) {
    uploadOtsarHahayalForeignTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

export const UPLOAD_OTSAR_CREDITCARD = /* GraphQL */ `
  mutation UploadOtsarHahayalCreditCardTransactions(
    $transactions: [OtsarHahayalCreditCardTransactionInput!]!
  ) {
    uploadOtsarHahayalCreditCardTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      insertedTransactions {
        id
        date
        description
        amount
        account
      }
      changedTransactions {
        id
        changedFields {
          field
          oldValue
          newValue
        }
      }
    }
  }
`;

// ── Variable builders ─────────────────────────────────────────────────────────
// Each function maps a typed payload to the mutation variables object.
// Field names match the GraphQL input types in graphql schema, which mirror
// the pgtyped INSERT param shapes from the legacy scraper.

export function poalimIlsVars(
  payload: HapoalimILSTransactions,
): UploadPoalimIlsTransactionsMutationVariables {
  // accountNumber / branchNumber / bankNumber are embedded in each transaction row
  // via retrievalTransactionData — spread onto every transaction so the server can
  // partition by account without a separate top-level arg.
  const { accountNumber, branchNumber, bankNumber } = payload.retrievalTransactionData;
  const transactions: UploadPoalimIlsTransactionsMutationVariables['transactions'] =
    payload.transactions.map(t => {
      const beneficiaryDetails: Pick<
        Exclude<UploadPoalimIlsTransactionsMutationVariables['transactions'], Array<unknown>>,
        | 'beneficiaryDetailsData'
        | 'beneficiaryDetailsDataMessageDetail'
        | 'beneficiaryDetailsDataMessageHeadline'
        | 'beneficiaryDetailsDataPartyHeadline'
        | 'beneficiaryDetailsDataPartyName'
        | 'beneficiaryDetailsDataRecordNumber'
        | 'beneficiaryDetailsDataTableNumber'
      > = t.beneficiaryDetailsData
        ? {
            beneficiaryDetailsData: null, // InputMaybe<Scalars['String']['input']>; OPTIONAL
            beneficiaryDetailsDataMessageDetail: t.beneficiaryDetailsData?.messageDetail, // InputMaybe<Scalars['String']['input']>; OPTIONAL
            beneficiaryDetailsDataMessageHeadline: t.beneficiaryDetailsData?.messageHeadline, // InputMaybe<Scalars['String']['input']>; OPTIONAL
            beneficiaryDetailsDataPartyHeadline: t.beneficiaryDetailsData?.partyHeadline, // InputMaybe<Scalars['String']['input']>; OPTIONAL
            beneficiaryDetailsDataPartyName: t.beneficiaryDetailsData?.partyName, // InputMaybe<Scalars['String']['input']>; OPTIONAL
            beneficiaryDetailsDataRecordNumber: t.beneficiaryDetailsData?.recordNumber, // InputMaybe<Scalars['Int']['input']>; OPTIONAL
            beneficiaryDetailsDataTableNumber: t.beneficiaryDetailsData?.tableNumber, // InputMaybe<Scalars['Int']['input']>; OPTIONAL
          }
        : {};
      return {
        accountNumber,
        activityDescription: t.activityDescription, // Scalars['String']['input'];
        activityDescriptionIncludeValueDate: t.activityDescriptionIncludeValueDate, // InputMaybe<Scalars['String']['input']>; OPTIONAL
        activityTypeCode: t.activityTypeCode, // Scalars['Int']['input'];
        bankNumber,
        ...beneficiaryDetails,
        branchNumber,
        comment: t.comment,
        commentExistenceSwitch: t.commentExistenceSwitch !== 0,
        contraAccountNumber: t.contraAccountNumber,
        contraAccountTypeCode: t.contraAccountTypeCode,
        contraBankNumber: t.contraBankNumber,
        contraBranchNumber: t.contraBranchNumber,
        currentBalance: t.currentBalance,
        dataGroupCode: t.dataGroupCode,
        details: t.details,
        differentDateIndication: t.differentDateIndication,
        englishActionDesc: t.englishActionDesc,
        eventActivityTypeCode: t.eventActivityTypeCode,
        eventAmount: t.eventAmount,
        eventDate: convertNumberDateToString(t.eventDate),
        eventId: String(t.eventId),
        executingBranchNumber: t.executingBranchNumber,
        expandedEventDate: t.expandedEventDate,
        fieldDescDisplaySwitch: t.fieldDescDisplaySwitch === 1,
        formattedEventDate: t.formattedEventDate,
        formattedOriginalEventCreateDate: t.formattedOriginalEventCreateDate,
        formattedValueDate: t.formattedValueDate,
        internalLinkCode: t.internalLinkCode,
        marketingOfferContext: t.marketingOfferContext !== 0,
        offerActivityContext: t.offerActivityContext,
        originalEventCreateDate: t.originalEventCreateDate,
        pfmDetails: t.pfmDetails,
        recordNumber: t.recordNumber,
        referenceCatenatedNumber: t.referenceCatenatedNumber,
        referenceNumber: String(t.referenceNumber),
        rejectedDataEventPertainingIndication: t.rejectedDataEventPertainingIndication,
        serialNumber: t.serialNumber,
        tableNumber: t.tableNumber,
        textCode: t.textCode,
        transactionType: t.transactionType,
        valueDate: convertNumberDateToString(t.valueDate),
      };
    });
  return { transactions };
}

export function poalimForeignVars(
  payload: HapoalimForeignTransactionsPersonal | HapoalimForeignTransactionsBusiness,
  account: {
    bankNumber: number;
    branchNumber: number;
    accountNumber: number;
  },
): UploadPoalimForeignTransactionsMutationVariables {
  // The foreign payload groups transactions by currency under balancesAndLimitsDataList.
  // Flatten to one row per transaction, carrying currencySwiftCode and account coords.
  const transactions: UploadPoalimForeignTransactionsMutationVariables['transactions'] =
    payload.balancesAndLimitsDataList.flatMap(entry => {
      const currency = convertPoalimCurrencyCodeToSymbol(entry.currencyCode);
      const bankNumber = 'bankNumber' in entry ? entry.bankNumber : account.bankNumber;
      const branchNumber = 'branchNumber' in entry ? entry.branchNumber : account.branchNumber;
      const accountNumber = 'accountNumber' in entry ? entry.accountNumber : account.accountNumber;
      return entry.transactions.map(t => {
        const metadataAttributes: Pick<
          Exclude<UploadPoalimForeignTransactionsMutationVariables['transactions'], Array<unknown>>,
          | 'metadataAttributesContraAccountFieldNameLable'
          | 'metadataAttributesContraAccountNumber'
          | 'metadataAttributesContraBankNumber'
          | 'metadataAttributesContraBranchNumber'
          | 'metadataAttributesContraCurrencyCode'
          | 'metadataAttributesCurrencyRate'
          | 'metadataAttributesDataGroupCode'
          | 'metadataAttributesOriginalEventKey'
          | 'metadataAttributesRateFixingCode'
        > = {};
        if (t.metadata) {
          if (t.metadata.attributes) {
            metadataAttributes.metadataAttributesOriginalEventKey = JSON.stringify(
              t.metadata.attributes.originalEventKey,
            );
            metadataAttributes.metadataAttributesContraBranchNumber = JSON.stringify(
              t.metadata.attributes.contraBranchNumber,
            );
            metadataAttributes.metadataAttributesContraAccountNumber = JSON.stringify(
              t.metadata.attributes.contraAccountNumber,
            );
            metadataAttributes.metadataAttributesContraBankNumber = JSON.stringify(
              t.metadata.attributes.contraBankNumber,
            );
            metadataAttributes.metadataAttributesContraAccountFieldNameLable = JSON.stringify(
              t.metadata.attributes.contraAccountFieldNameLable,
            );
            metadataAttributes.metadataAttributesDataGroupCode = JSON.stringify(
              t.metadata.attributes.dataGroupCode,
            );
            metadataAttributes.metadataAttributesCurrencyRate = JSON.stringify(
              t.metadata.attributes.currencyRate,
            );
            metadataAttributes.metadataAttributesContraCurrencyCode = JSON.stringify(
              t.metadata.attributes.contraCurrencyCode,
            );
            metadataAttributes.metadataAttributesRateFixingCode = JSON.stringify(
              t.metadata.attributes.rateFixingCode,
            );
          } else {
            metadataAttributes.metadataAttributesContraAccountFieldNameLable = null;
            metadataAttributes.metadataAttributesContraAccountNumber = null;
            metadataAttributes.metadataAttributesContraBankNumber = null;
            metadataAttributes.metadataAttributesContraBranchNumber = null;
            metadataAttributes.metadataAttributesContraCurrencyCode = null;
            metadataAttributes.metadataAttributesCurrencyRate = null;
            metadataAttributes.metadataAttributesDataGroupCode = null;
            metadataAttributes.metadataAttributesOriginalEventKey = null;
            metadataAttributes.metadataAttributesRateFixingCode = null;
          }
        }

        return {
          accountName: 'accountName' in t ? t.accountName : null,
          accountNumber,
          activityDescription: t.activityDescription,
          activityTypeCode: t.activityTypeCode,
          bankNumber,
          branchNumber,
          commentExistenceSwitch:
            'commentExistenceSwitch' in t ? t.commentExistenceSwitch !== 0 : false,
          comments: 'comments' in t ? t.comments : null,
          contraAccountFieldNameLable:
            'contraAccountFieldNameLable' in t ? t.contraAccountFieldNameLable : null,
          contraAccountNumber: 'contraAccountNumber' in t ? t.contraAccountNumber : 0,
          contraBankNumber: 'contraBankNumber' in t ? t.contraBankNumber : 0,
          contraBranchNumber: 'contraBranchNumber' in t ? t.contraBranchNumber : 0,
          contraCurrencyCode: t.contraCurrencyCode,
          currency,
          currencyLongDescription: t.currencyLongDescription,
          currencyRate: t.currencyRate,
          currencySwiftCode: t.currencySwiftCode,
          currentBalance: t.currentBalance,
          dataGroupCode: 'dataGroupCode' in t ? t.dataGroupCode !== 0 : false,
          eventActivityTypeCode: t.eventActivityTypeCode,
          eventAmount: t.eventAmount,
          eventDetails: t.eventDetails,
          eventNumber: t.eventNumber,
          executingDate: convertNumberDateToString(t.executingDate),
          formattedExecutingDate: t.formattedExecutingDate,
          formattedValueDate: t.formattedValueDate,
          ...metadataAttributes,
          originalEventKey: 'originalEventKey' in t ? t.originalEventKey !== 0 : false,
          originalSystemId: t.originalSystemId,
          rateFixingCode: t.rateFixingCode,
          rateFixingDescription: t.rateFixingDescription,
          rateFixingShortDescription: t.rateFixingShortDescription,
          referenceCatenatedNumber: t.referenceCatenatedNumber,
          referenceNumber: String(t.referenceNumber),
          transactionType: t.transactionType,
          urlAddress: t.urlAddress,
          validityDate: convertNumberDateToString(t.validityDate),
          valueDate: convertNumberDateToString(t.valueDate),
        };
      });
    });
  return { transactions } as UploadPoalimForeignTransactionsMutationVariables;
}

export function poalimSwiftVars(
  payload: DecoratedSwiftTransactions,
  bankAccount: {
    bankNumber: number;
    branchNumber: number;
    accountNumber: number;
  },
): UploadPoalimSwiftTransactionsMutationVariables {
  const swifts = payload.swiftsList.map(s => ({
    accountNumber: bankAccount.accountNumber,
    branchNumber: bankAccount.branchNumber,
    bankNumber: bankAccount.bankNumber,

    startDate: s.startDate.toString(),
    formattedStartDate: s.formattedStartDate,
    swiftStatusCode: s.swiftStatusCode,
    swiftStatusDesc: s.swiftStatusDesc,
    amount: s.amount,
    currencyCodeCatenatedKey: s.currencyCodeCatenatedKey,
    currencyLongDescription: s.currencyLongDescription,
    chargePartyName: s.chargePartyName,
    referenceNumber: s.referenceNumber,
    transferCatenatedId: s.transferCatenatedId,
    dataOriginCode: s.dataOriginCode.toString(),

    swiftIsnSerialNumber: s.details.swiftBankDetails.swiftIsnSerialNumber,
    swiftBankCode: s.details.swiftBankDetails.swiftBankCode,
    orderCustomerName: s.details.swiftBankDetails.orderCustomerName,
    beneficiaryEnglishStreetName: s.details.swiftBankDetails.beneficiaryEnglishStreetName1,
    beneficiaryEnglishCityName: s.details.swiftBankDetails.beneficiaryEnglishCityName1,
    beneficiaryEnglishCountryName: s.details.swiftBankDetails.beneficiaryEnglishCountryName,

    swiftSendersReference20: findPoalimSwiftElement(s.details, ':20:'),
    swiftBankOperationCode23B: findPoalimSwiftElement(s.details, ':23B:'),
    swiftInstructionCode23E: findPoalimSwiftElement(s.details, ':23E:'),
    swiftValueDateCurrencyAmount32A: findPoalimSwiftElement(s.details, ':32A:'),

    swiftCurrencyInstructedAmount33B: findPoalimSwiftElement(s.details, ':33B:', true),
    swiftExchangeRate36: findPoalimSwiftElement(s.details, ':36:', true),

    swiftOrderingCustomer50K:
      findPoalimSwiftElement(s.details, ':50K:') ??
      findPoalimSwiftElement(s.details, ':50F:', true),

    swiftOrderingInstitution52A: findPoalimSwiftElement(s.details, ':52A:', true),

    swiftOrderingInstitution52D: findPoalimSwiftElement(s.details, ':52D:', true),

    swiftSendersCorrespondent53A:
      findPoalimSwiftElement(s.details, ':53B:') ??
      findPoalimSwiftElement(s.details, ':53A:', true),

    swiftReceiversCorrespondent54A: findPoalimSwiftElement(s.details, ':54A:', true),

    swiftAccountWithInstitution57:
      findPoalimSwiftElement(s.details, ':57A:') ??
      findPoalimSwiftElement(s.details, ':57D:', true),

    swiftBeneficiaryCustomer59:
      findPoalimSwiftElement(s.details, ':59:') ?? findPoalimSwiftElement(s.details, ':59F:', true),

    swiftRemittanceInformation70: findPoalimSwiftElement(s.details, ':70:', true),

    swiftDetailsOfCharges71A: findPoalimSwiftElement(s.details, ':71A:', true),

    swiftSendersCharges71F: findPoalimSwiftElement(s.details, ':71F:', true),

    swiftSendersToReceiverInformation72: findPoalimSwiftElement(s.details, ':72:', true),

    swiftRegulatoryReporting77B: findPoalimSwiftElement(s.details, ':77B:', true),
  }));
  return { swifts } as UploadPoalimSwiftTransactionsMutationVariables;
}

function transformIsracardAmexTransaction(
  t:
    | Exclude<
        IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][0]['txnIsrael'],
        null | undefined
      >[0]
    | Exclude<
        IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][0]['txnAbroad'],
        null | undefined
      >[0],
  card: string,
): IsracardTransactionInput {
  const inputTransaction: IsracardTransactionInput = {
    card,
    specificDate: t.specificDate,
    cardIndex: Number.parseInt(t.cardIndex, 10),
    dealsInbound: t.dealsInbound,
    supplierId: t.supplierId ? Number(t.supplierId) : null,
    supplierName: t.supplierName,
    dealSumType: t.dealSumType,
    paymentSumSign: t.paymentSumSign,
    purchaseDate: t.purchaseDate,
    fullPurchaseDate: t.fullPurchaseDate,
    moreInfo: t.moreInfo,
    horaatKeva: t.horaatKeva,
    voucherNumber: t.voucherNumber ? Number(t.voucherNumber) : null,
    voucherNumberRatz: t.voucherNumberRatz ? Number(t.voucherNumberRatz) : null,
    solek: t.solek,
    purchaseDateOutbound: t.purchaseDateOutbound,
    fullPurchaseDateOutbound: t.fullPurchaseDateOutbound,
    currencyId: t.currencyId,
    currentPaymentCurrency: t.currentPaymentCurrency,
    city: t.city,
    supplierNameOutbound: t.supplierNameOutbound,
    fullSupplierNameOutbound: t.fullSupplierNameOutbound,
    paymentDate: t.paymentDate,
    fullPaymentDate: t.fullPaymentDate,
    isShowDealsOutbound: t.isShowDealsOutbound,
    adendum: t.adendum,
    voucherNumberRatzOutbound: t.voucherNumberRatzOutbound
      ? Number(t.voucherNumberRatzOutbound)
      : null,
    isShowLinkForSupplierDetails: t.isShowLinkForSupplierDetails,
    dealSum: t.dealSum,
    paymentSum: t.paymentSum,
    fullSupplierNameHeb: t.fullSupplierNameHeb,
    dealSumOutbound: t.dealSumOutbound,
    paymentSumOutbound: t.paymentSumOutbound,
    isHoraatKeva: t.isHoraatKeva,
    stage: t.stage,
    returnCode: t.returnCode,
    message: t.message,
    returnMessage: t.returnMessage,
    displayProperties: t.displayProperties,
    tablePageNum: t.tablePageNum === '0' ? false : true,
    isError: t.isError,
    isCaptcha: t.isCaptcha,
    isButton: t.isButton,
    siteName: t.siteName,
    kodMatbeaMekori: t.kodMatbeaMekori ?? null,
    esbServicesCall: t.EsbServicesCall ?? null,
  };

  // remove known unstable keys from input transaction
  const optionalTransactionKeys = [
    'clientIpAddress',
    'bcKey',
    'chargingDate',
    'requestNumber',
    'accountErrorCode',
    'monthlyRefundCardIndex',
    'id',
    'EsbServicesCall', // renamed to esbServicesCall above, to coerce to camelCase
  ];

  for (const key of optionalTransactionKeys) {
    if (inputTransaction[key as keyof IsracardTransactionInput] !== undefined) {
      delete inputTransaction[key as keyof IsracardTransactionInput];
    }
  }

  return inputTransaction;
}

// Isracard / Amex: CardsTransactionsListBean → flatten to per-transaction rows.
// Each row gets `card` (the 4-digit card identifier from cardNumberList),
// matching the `card` column the legacy scraper writes.
function flattenIsracardAmexPayloads(
  payloads: IsracardCardsTransactionsList[],
): IsracardTransactionInput[] {
  return payloads.flatMap(p => {
    const cardNumbers = p.CardsTransactionsListBean.cardNumberList.map(c => c.match(/\d{4}/)?.[0]);
    return Object.keys(p.CardsTransactionsListBean)
      .filter(k => /^Index\d+$/.test(k))
      .flatMap(k => {
        const card = cardNumbers[Number(k.slice(5))]; // 'Index0' → 0 → cardNumbers[0]
        if (!card) {
          throw new Error(`Missing card number for ${k} in Isracard payload`);
        }
        const idx = p.CardsTransactionsListBean[
          k
        ] as IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0'];
        return idx.CurrentCardTransactions.flatMap(cardGroup => {
          const israelTxns = (cardGroup.txnIsrael ?? []).map(t =>
            transformIsracardAmexTransaction(t, card),
          );
          const abroadTxns = (cardGroup.txnAbroad ?? []).map(t =>
            transformIsracardAmexTransaction(t, card),
          );
          return [...israelTxns, ...abroadTxns];
        });
      });
  });
}

export function isracardVars(
  payloads: IsracardCardsTransactionsList[],
): MutationUploadIsracardTransactionsArgs {
  return { transactions: flattenIsracardAmexPayloads(payloads) };
}

export function amexVars(
  payloads: IsracardCardsTransactionsList[],
): MutationUploadAmexTransactionsArgs {
  return { transactions: flattenIsracardAmexPayloads(payloads) };
}

export function calVars(payload: CalPayload) {
  // CalPayload is { card, month, transactions[] }[] — flatten to per-transaction rows.
  // Each row gets `card` from the outer entry so the server knows which card it belongs to.
  const transactions = payload.flatMap(entry =>
    entry.transactions.map(t => ({
      ...t,
      card: entry.card,
      // Coerce numeric string fields
      trnAmt: t.trnAmt == null ? null : String(t.trnAmt),
      amtBeforeConvAndIndex:
        t.amtBeforeConvAndIndex == null ? null : String(t.amtBeforeConvAndIndex),
      cashAccountTrnAmt: t.cashAccountTrnAmt == null ? null : String(t.cashAccountTrnAmt),
    })),
  );
  return { transactions };
}

export function discountVars(payload: DiscountPayload) {
  // DiscountPayload is { accountNumber, month, balance, transactions[] }[] — flatten.
  // The scraper returns PascalCase field names (OperationDate, etc.); map to camelCase
  // to match the GraphQL input type and DB column conventions.
  const transactions = payload.flatMap(entry =>
    entry.transactions.map(t => {
      const raw = t as Record<string, unknown>;
      return {
        accountNumber: entry.accountNumber,
        operationDate: raw['OperationDate'] ?? null,
        valueDate: raw['ValueDate'] ?? null,
        operationCode: raw['OperationCode'] ?? null,
        operationDescription: raw['OperationDescription'] ?? null,
        operationDescription2: raw['OperationDescription2'] ?? null,
        operationDescription3: raw['OperationDescription3'] ?? null,
        operationBranch: raw['OperationBranch'] ?? null,
        operationBank: raw['OperationBank'] ?? null,
        channel: raw['Channel'] ?? null,
        channelName: raw['ChannelName'] ?? null,
        checkNumber: raw['CheckNumber'] ?? null,
        instituteCode: raw['InstituteCode'] ?? null,
        operationAmount: raw['OperationAmount'] == null ? null : String(raw['OperationAmount']),
        balanceAfterOperation:
          raw['BalanceAfterOperation'] == null ? null : String(raw['BalanceAfterOperation']),
        operationNumber: raw['OperationNumber'] ?? null,
        branchTreasuryNumber: raw['BranchTreasuryNumber'] ?? null,
        urn: raw['Urn'] ?? null,
        operationDetailsServiceName: raw['OperationDetailsServiceName'] ?? null,
        commissionChannelCode: raw['CommissionChannelCode'] ?? null,
        commissionChannelName: raw['CommissionChannelName'] ?? null,
        commissionTypeName: raw['CommissionTypeName'] ?? null,
        businessDayDate: raw['BusinessDayDate'] ?? null,
        eventName: raw['EventName'] ?? null,
        categoryCode: raw['CategoryCode'] ?? null,
        categoryDescCode: raw['CategoryDescCode'] ?? null,
        categoryDescription: raw['CategoryDescription'] ?? null,
        operationDescriptionToDisplay: raw['OperationDescriptionToDisplay'] ?? null,
        operationOrder: raw['OperationOrder'] ?? null,
        isLastSeen: raw['IsLastSeen'] ?? null,
      };
    }),
  );
  return { transactions };
}

export function maxVars(payload: MaxPayload) {
  // MaxPayload is { accountNumber, txns[] }[] — flatten to per-transaction rows.
  const transactions = payload.flatMap(entry =>
    entry.txns.map(t => ({
      ...t,
      // Coerce numeric string fields
      actualPaymentAmount: t.actualPaymentAmount == null ? null : String(t.actualPaymentAmount),
      dealDataAmount: t.dealDataAmount == null ? null : String(t.dealDataAmount),
      dealDataAmountIls: t.dealDataAmountIls == null ? null : String(t.dealDataAmountIls),
    })),
  );
  return { transactions };
}

export function otsarIlsVars(
  ilsData: OtsarHahayalIlsData[],
): MutationUploadOtsarHahayalIlsTransactionsArgs {
  const transactions = ilsData.flatMap(({ account, accountType, transactions: txns }) =>
    txns.map(t => ({
      accountNumber: Number(account.account),
      accountType,
      branchNumber: Number(account.branch),
      actionCode: t.ActionCode,
      bfbSource: t.bfbSource,
      closingBalance: t.closingBalance,
      correspondentAccount: t.CorrespondentAccount,
      correspondentAccountType: t.CorrespondentAccountType,
      correspondentBank: t.CorrespondentBank,
      correspondentBranch: t.CorrespondentBranch,
      creditAmount: t.creditAmount,
      customerName: t.CustomerName,
      dateOfBusinessDay: t.dateOfBusinessDay,
      dateOfRegistration: t.dateOfRegistration,
      debitAmount: t.debitAmount,
      depositorId: t.DepositorId,
      description: t.description,
      drillDownUrl: t.drillDownUrl,
      drillDownData: t.drillDownData == null ? undefined : JSON.stringify(t.drillDownData),
      firstTransactionOfDay: t.firstTransactionOfDay,
      lastTransactionOfDay: t.lastTransactionOfDay,
      name: t.Name,
      openingBalance: t.openingBalance,
      operationSource: t.OprationSource,
      originReference: t.originReference ?? undefined,
      reference: t.reference,
      salaryInd: t.SalaryInd,
      transactionReason: t.TransactionReason,
      transactionSource: t.transactionSource,
    })),
  );
  return { transactions };
}

export function otsarForeignVars(
  foreignData: ForeignAccountData[],
): MutationUploadOtsarHahayalForeignTransactionsArgs {
  const transactions = foreignData.flatMap(({ metadata, transactions: txns }) =>
    txns.map(t => ({
      account: metadata.account,
      branch: metadata.branch,
      accountType: metadata.accountType,
      currency: metadata.currency,
      openingBalance: metadata.openingBalance,
      balance: t.balance ?? undefined,
      valueDate: t.valueDate,
      credit: t.credit,
      debit: t.debit,
      description: t.description,
      sp: t.sp ?? undefined,
      reference: t.reference,
      date: t.date,
      subTransactions: JSON.stringify(t.subTransactions),
    })),
  );
  return { transactions };
}

export function otsarCreditCardVars(
  creditCardData: OtsarHahayalCreditCardData[],
): MutationUploadOtsarHahayalCreditCardTransactionsArgs {
  const transactions = creditCardData.flatMap(({ card, dealGroup, transactions: txns }) =>
    txns.map(t => ({
      resourceId: card.resourceId,
      maskedPan: card.maskedPan,
      cardType: card.cardType,
      dealGroup,
      date: t.date,
      chargeDate: t.chargeDate,
      name: t.name,
      dealAmount: t.dealAmount,
      chargeAmount: t.chargeAmount,
      notes: t.notes,
      walletType: t.walletType,
      chargeCurrency: t.chargeCurrency,
      dealCurrency: t.dealCurrency,
      counter: t.counter ?? 0,
    })),
  );
  return { transactions };
}

export function currencyRatesVars(payload: CurrencyRatesPayload) {
  // CurrencyRatesPayload is { date, currency, rate }[] — one entry per currency per day.
  // The DB table has one row per date with one column per currency.
  // Pivot: group by date, set the matching currency column.
  const byDate = new Map<string, Record<string, number | undefined>>();
  for (const entry of payload) {
    const row = byDate.get(entry.date) ?? {};
    row[entry.currency.toLowerCase()] = entry.rate;
    byDate.set(entry.date, row);
  }
  const rates = Array.from(byDate.entries()).map(([exchangeDate, cols]) => ({
    exchangeDate,
    usd: cols['usd'],
    eur: cols['eur'],
    gbp: cols['gbp'],
    cad: cols['cad'],
    jpy: cols['jpy'],
    aud: cols['aud'],
    sek: cols['sek'],
  }));
  return { rates };
}
