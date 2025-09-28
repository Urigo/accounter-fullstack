import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { suggestionDataSchema } from '@modules/documents/helpers/suggestion-data-schema.helper.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { formatAmount } from '@shared/helpers';
import { TransactionsProvider } from '../providers/transactions.provider.js';
import type { TransactionsModule } from '../types.js';

type Suggestion = Omit<Awaited<ResolversTypes['TransactionSuggestions']>, 'business'> & {
  business: string;
};

type DecoratedSuggestion = Suggestion & {
  priority: number;
};

function sortPhrasesByPriority(
  a: [string, DecoratedSuggestion],
  b: [string, DecoratedSuggestion],
): number {
  return b[1].priority - a[1].priority;
}

const missingInfoSuggestions = async (
  transactionId: ResolversParentTypes['CommonTransaction'],
  _: object,
  { injector, adminContext }: GraphQLModules.Context,
  __: GraphQLResolveInfo,
): Promise<Maybe<Suggestion>> => {
  const {
    poalimBusinessId,
    etherScanBusinessId,
    krakenBusinessId,
    etanaBusinessId,
    isracardBusinessId,
  } = adminContext.financialAccounts;

  const transaction = await injector
    .get(TransactionsProvider)
    .transactionByIdLoader.load(transactionId);

  if (transaction.business_id) {
    return null;
  }

  if (transaction.is_fee) {
    if (transaction.source_description?.includes('Swift')) {
      const { swiftBusinessId } = adminContext.financialAccounts;
      if (!swiftBusinessId) {
        throw new Error('Swift business is not set');
      }
      return {
        business: swiftBusinessId,
      };
    }
    switch (transaction.source_origin) {
      case 'ETANA': {
        if (!etanaBusinessId) {
          throw new Error('Etana business is not set');
        }
        return {
          business: etanaBusinessId,
        };
      }
      case 'ETHERSCAN': {
        if (!etherScanBusinessId) {
          throw new Error('EtherScan business is not set');
        }
        return {
          business: etherScanBusinessId,
        };
      }
      case 'KRAKEN': {
        if (!krakenBusinessId) {
          throw new Error('Kraken business is not set');
        }
        return {
          business: krakenBusinessId,
        };
      }
      case 'POALIM': {
        if (!poalimBusinessId) {
          throw new Error('Poalim business is not set');
        }
        return {
          business: poalimBusinessId,
        };
      }
      case 'ISRACARD': {
        if (!isracardBusinessId) {
          throw new Error('Isracard business is not set');
        }
        return {
          business: isracardBusinessId,
        };
      }
    }
  }

  if (transaction.business_id) {
    const business = await injector
      .get(BusinessesProvider)
      .getBusinessByIdLoader.load(transaction.business_id);

    if (business?.suggestion_data) {
      return {
        business: business.id,
      };
    }
  }

  const description = transaction.source_description?.trim() ?? '';

  const businesses = await injector
    .get(BusinessesProvider)
    .getAllBusinesses()
    .then(businesses => businesses.filter(business => business.suggestion_data));
  const suggestions: Record<string, DecoratedSuggestion> = {};
  for (const business of businesses) {
    const { data: suggestionData, success } = suggestionDataSchema.safeParse(
      business.suggestion_data,
    );
    if (!success) continue;
    if (!suggestionData.phrases) continue;

    for (const phrase of suggestionData.phrases) {
      suggestions[phrase] = {
        business: business.id,
        priority: suggestionData.priority ?? 0,
      };
    }
  }

  for (const [phrase, suggestion] of Object.entries(suggestions).sort(sortPhrasesByPriority)) {
    if (Array.isArray(phrase) && new RegExp(phrase.join('|')).test(description)) {
      return suggestion;
    }
    if (description.includes(phrase)) {
      return suggestion;
    }
  }

  switch (transaction.source_origin) {
    case 'ETANA': {
      if (!etanaBusinessId) {
        throw new Error('Etana business is not set');
      }
      if (transaction.is_fee || /\bfee\b/.test(description.toLowerCase())) {
        return {
          business: etanaBusinessId,
        };
      }
      const amount = formatAmount(transaction.amount);
      if (poalimBusinessId && amount < 0) {
        return {
          business: poalimBusinessId,
        };
      }
      if (krakenBusinessId && amount > 0) {
        return {
          business: krakenBusinessId,
        };
      }
      break;
    }
    case 'ETHERSCAN': {
      if (!etherScanBusinessId) {
        throw new Error('EtherScan business is not set');
      }
      if (transaction.is_fee || /\bfee\b/.test(description.toLowerCase())) {
        return {
          business: etherScanBusinessId,
        };
      }
      const amount = formatAmount(transaction.amount);
      if (krakenBusinessId && amount < 0) {
        return {
          business: krakenBusinessId,
        };
      }
      if (amount > 0) {
        return {
          business: '73519067-c8fe-4073-aec6-608ff596f8a8', // name: 'The Graph Foundation'
        };
      }
      break;
    }
    case 'KRAKEN': {
      if (!krakenBusinessId) {
        throw new Error('Kraken business is not set');
      }
      if (
        transaction.is_fee ||
        /\bfee\b/.test(description.toLowerCase()) ||
        /\btrade\b/.test(description.toLowerCase())
      ) {
        return {
          business: krakenBusinessId,
        };
      }
      const amount = formatAmount(transaction.amount);
      if (etanaBusinessId && amount < 0) {
        return {
          business: etanaBusinessId,
        };
      }
      if (etherScanBusinessId && amount > 0) {
        return {
          business: etherScanBusinessId,
        };
      }
      break;
    }
  }

  if (
    poalimBusinessId &&
    (description.includes('ע\' העברת מט"ח') ||
      (description.includes('העברת מט"ח') && Math.abs(formatAmount(transaction.amount)) < 400) ||
      (description.includes('מטח') && Math.abs(formatAmount(transaction.amount)) < 400) ||
      description.includes('F.C.COM') ||
      description.includes('ע.מפעולות-ישיר') ||
      description.includes('ריבית חובה') ||
      description.includes('FEE'))
  ) {
    return {
      business: poalimBusinessId,
    };
  }
  if (description.includes('דותן שמחה') || description.includes('שמחה דותן')) {
    return {
      business: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df', //name: 'Dotan Employee',
    };
  }
  if (description.includes('גולדשטין אורי')) {
    return {
      business: '7843b805-3bb7-4d1c-9219-ff783100334b', //name: 'Uri Employee',
    };
  }
  if (description.includes('גרדוש')) {
    return {
      business: 'f4b591f3-d817-4e3d-9ecb-35b38d2df7ef', //name: 'Gil Employee',
    };
  }
  if (description.includes('תובל')) {
    return {
      business: '4420accf-da13-43b0-9aaa-3b94758598e4', //name: 'Tuval Employee',
    };
  }
  if (description.includes('מנורה מבטחים פנס')) {
    return {
      business: 'af386033-a577-4c9a-880a-d49acd15141d', //name: 'מנורה פנסיה',
    };
  }
  if (description.includes('פניקס אקסלנס')) {
    return {
      business: '1453f8d1-adae-4761-851b-83799290b8d1', //name: 'פניקס השתלמות',
    };
  }
  if (description.includes('מיטב דש גמל ופנס')) {
    return {
      business: '340c3552-0a15-4e22-ba03-19ae9322859c', //name: 'איילון פנסיה',
    };
  }
  if (description.includes('מגדל מקפת')) {
    return {
      business: 'fc2ea992-a2be-4f8a-a639-542a81276beb', //name: 'מגדל פנסיה',
    };
  }
  if (description.includes('מגדל השתלמות')) {
    return {
      business: '2697dae8-cbd5-4669-8e80-d0964e5c077e', //name: 'מגדל השתלמות',
    };
  }
  if (description.includes('ביטוח לאומי')) {
    return {
      business: '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', //name: 'Social Security Deductions',
    };
  }
  if (description.includes('LANCE GLOBAL')) {
    return {
      business: '9c9f3979-08b1-453c-832a-d5eba2bba79a', //name: 'Lance Global Inc',
    };
  }
  if (
    (description.includes('העברת מט"ח') &&
      (description.includes('fbv') || description.includes('fv'))) ||
    description.includes('kamil kisiela')
  ) {
    return {
      business: 'f1749353-979b-46df-8931-93a3aafab1f4', //name: 'Jelly JS Kamil Kisiela',
    };
  }
  if (description.includes('מס הכנסה')) {
    const flag = description.includes('מס הכנסה ני');
    return {
      business: flag
        ? 'f1ade516-4999-4919-9d94-6b013221536d' //name: 'Tax Deductions',
        : '9d3a8a88-6958-4119-b509-d50a7cdc0744', //name: 'Tax',
    };
  }
  if (description.includes('המכס ומעמ-גביי תשלום') || description.includes('CUSTOM + V.A.T')) {
    return {
      business: 'c7fdf6f6-e075-44ee-b251-cbefea366826', //name: 'VAT',
    };
  }
  if (description.includes('חניון')) {
    return {
      business: description.includes('אחוזות החוף')
        ? 'b51aeb4d-48ed-43e5-84a2-f12b6905fd51' //name: 'Ahuzot',
        : 'ed7b54f1-f695-4bc2-b8af-887e3115bfcc', //name: 'Parking',
    };
  }
  if (description.includes('deel')) {
    return {
      business: '8d34f668-7233-4ce3-9c9c-82550b0839ff', //name: 'Deel Germany GmbH',
    };
  }
  if (description.includes('GITHUB')) {
    const suggested = {
      business: 'af23ab30-5cf9-4433-abe1-14ae70ab64d7', //name: 'GitHub, Inc',
    };
    return suggested;
  }
  if (formatAmount(transaction.amount) === -4329) {
    return {
      business: '8069311d-314e-4d1a-8f76-629757070ca0', //name: 'Avi Peretz',
    };
  }
  if (description.includes('APPLE COM BILL/ITUNES.COM')) {
    return {
      business: '6346872a-708d-4910-9428-72019b053ea5', //name: 'Apple',
    };
  }
  if (
    poalimBusinessId &&
    (description.includes('ע\' העברת מט"ח') ||
      (description.includes('העברת מט"ח') && Math.abs(formatAmount(transaction.amount)) < 400) ||
      (description.includes('מטח') && Math.abs(formatAmount(transaction.amount)) < 400) ||
      description.includes('F.C.COM') ||
      description.includes('ע.מפעולות-ישיר') ||
      description.includes('ריבית חובה') ||
      description.includes('FEE'))
  ) {
    return {
      business: poalimBusinessId,
    };
  }
  if (poalimBusinessId && description.includes('ריבית זכות')) {
    return {
      business: poalimBusinessId,
    };
  }
  if (poalimBusinessId && description.includes('פועלים- דמי כרטיס')) {
    return {
      business: poalimBusinessId,
    };
  }
  if (description.includes('אריה קריסטל')) {
    return {
      business: '245e149b-b328-471f-9e11-bdaa10dc5fb7', //name: 'Arye Kristal',
    };
  }
  if (description.includes('aleksandra')) {
    return {
      business: 'b001b503-93ce-497c-bb6c-1c5f1eb6b776', //name: 'ALEKSANDRA MONWID-OLECHNOWICZ'
    };
  }
  if (description.includes('denelop')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    return {
      business: '737df651-8e02-40dd-b749-228bad16f279',
    };
  }
  if (description.includes('slava')) {
    return {
      business: '74c8b843-3819-44a0-abc6-730d4d829e9f', // SLAVA UKRAINI
    };
  }
  if (description.includes('COURIER PLUS INC')) {
    return {
      business: '74c8a4e0-ea3b-4906-a6b3-a868ee6d700d', // name: 'Courier Plus Inc DBA Dutchie'
    };
  }
  if (description.includes('GOBRANDS')) {
    return {
      business: '011dac15-1a48-447e-91f0-ef4344137caa', // name: 'GoBrands Inc'
    };
  }
  if (description.includes('MEDIC FIRST AI')) {
    return {
      business: 'dcb28428-6ba4-4ee3-94a9-ebd188c82822', // name: 'HSI Workplace Compliance Solutions, Inc'
    };
  }
  if (formatAmount(transaction.amount) === -12_000) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    return {
      business: 'd140fae3-f841-464c-84a7-c526c0123f36', //name: 'Saihajpreet Singh',
    };
  }
  if (formatAmount(transaction.amount) === -600) {
    return {
      business: '02d467c9-0818-45e3-9a25-9f99d0101a9e', //name: 'ZAUM',
    };
  }

  return null;
};

function missingInfoSuggestionsWrapper(
  ...args: Parameters<
    ResolverFn<
      Maybe<ResolversTypes['TransactionSuggestions']>,
      ResolversParentTypes['ConversionTransaction'],
      GraphQLModules.Context,
      object
    >
  >
) {
  return missingInfoSuggestions(...args).then(res => {
    if (res && 'business' in res) {
      return {
        ...res,
        business: args[2].injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(res.business),
      } as ResolversTypes['TransactionSuggestions'];
    }
    return res;
  });
}

export const transactionSuggestionsResolvers: TransactionsModule.Resolvers = {
  Query: {
    similarTransactions: async (_, { transactionId, withMissingInfo = false }, { injector }) => {
      if (!transactionId?.trim()) {
        throw new GraphQLError('Transaction ID is required');
      }

      const mainTransactionPromise = injector
        .get(TransactionsProvider)
        .transactionByIdLoader.load(transactionId)
        .catch(e => {
          console.error('Error fetching transaction', { transactionId, error: e });
          throw new GraphQLError('Error fetching transaction');
        });

      const chargePromise = injector
        .get(ChargesProvider)
        .getChargeByTransactionIdLoader.load(transactionId)
        .catch(e => {
          console.error('Error fetching charge', { transactionId, error: e });
          throw new GraphQLError('Error fetching charge');
        });

      const [mainTransaction, charge] = await Promise.all([mainTransactionPromise, chargePromise]);

      if (!mainTransaction) {
        throw new GraphQLError(`Transaction not found: ${transactionId}`);
      }
      if (!charge) {
        throw new GraphQLError(`Charge not found for transaction: ${transactionId}`);
      }

      const similarTransactions = await injector
        .get(TransactionsProvider)
        .getSimilarTransactions({
          details: mainTransaction.source_description,
          counterAccount: mainTransaction.counter_account,
          withMissingInfo,
          ownerId: charge.owner_id,
        })
        .catch(e => {
          console.error('Error fetching similar transactions:', {
            transactionId,
            details: mainTransaction.source_description,
            counterAccount: mainTransaction.counter_account,
            error: e.message,
          });
          throw new GraphQLError('Error fetching similar transactions');
        });
      return similarTransactions.map(txn => txn.id);
    },
  },
  ConversionTransaction: {
    missingInfoSuggestions: missingInfoSuggestionsWrapper,
  },
  CommonTransaction: {
    missingInfoSuggestions: missingInfoSuggestionsWrapper,
  },
};
