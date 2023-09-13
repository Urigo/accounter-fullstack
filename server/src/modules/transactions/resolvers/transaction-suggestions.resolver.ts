import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import {
  Maybe,
  Resolver,
  ResolversParentTypes,
  ResolversTypes,
  TransactionResolvers,
} from '@shared/gql-types';
import { formatAmount } from '@shared/helpers';
import type { TransactionsModule } from '../types.js';

type SuggestionData = {
  beneficiaries?: Array<{ counterpartyID: string; percentage: number }>;
  phrases: Array<string>;
};

type Suggestion = Omit<Awaited<ResolversTypes['TransactionSuggestions']>, 'business'> & {
  business: string;
};

const COMMON_BENEFICIARIES = [
  {
    counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
    percentage: 0.5,
  },
  {
    counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
    percentage: 0.5,
  },
];

const missingInfoSuggestions: Resolver<
  Maybe<Suggestion>,
  ResolversParentTypes['CommonTransaction'],
  GraphQLModules.Context
> = async (DbTransaction, _, { injector }) => {
  if (
    DbTransaction.business_id
    // TODO: Re-enable beneficiaries after this feature is re-enabled
    // DbTransaction.financial_accounts_to_balance
  ) {
    return null;
  }

  if (DbTransaction.business_id) {
    const business = await injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.load(DbTransaction.business_id);

    if (business?.suggestion_data) {
      const suggestionData = business.suggestion_data as SuggestionData;
      return {
        business: business.id,
        beneficiaries: suggestionData.beneficiaries,
      };
    }
  }

  const description = DbTransaction.source_description?.trim() ?? '';

  const businesses = await injector
    .get(FinancialEntitiesProvider)
    .getAllFinancialEntities()
    .then(businesses => businesses.filter(business => business.suggestion_data));
  const suggestions: Record<string, Suggestion> = {};
  for (const business of businesses) {
    if (!business.suggestion_data) continue;
    const suggestionData = business.suggestion_data as SuggestionData;

    for (const phrase of suggestionData.phrases) {
      suggestions[phrase] = {
        business: business.id,
        beneficiaries: suggestionData.beneficiaries,
      };
    }
  }

  for (const [phrase, suggestion] of Object.entries(suggestions)) {
    if (Array.isArray(phrase) && new RegExp(phrase.join('|')).test(description)) {
      return suggestion;
    }
    if (description.includes(phrase)) {
      return suggestion;
    }
  }

  if (
    description.includes('ע\' העברת מט"ח') ||
    (description.includes('העברת מט"ח') && Math.abs(formatAmount(DbTransaction.amount)) < 400) ||
    (description.includes('מטח') && Math.abs(formatAmount(DbTransaction.amount)) < 400) ||
    description.includes('F.C.COM') ||
    description.includes('ע.מפעולות-ישיר') ||
    description.includes('ריבית חובה') ||
    description.includes('FEE')
  ) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
    };
  }
  if (description.includes('דותן שמחה') || description.includes('שמחה דותן')) {
    return {
      business: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df', //name: 'Dotan Employee',
      beneficiaries: [
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 1,
        },
      ],
    };
  }
  if (description.includes('גולדשטין אורי')) {
    return {
      business: '7843b805-3bb7-4d1c-9219-ff783100334b', //name: 'Uri Employee',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 1,
        },
      ],
    };
  }
  if (description.includes('גרדוש')) {
    return {
      business: 'f4b591f3-d817-4e3d-9ecb-35b38d2df7ef', //name: 'Gil Employee',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('תובל')) {
    return {
      business: '4420accf-da13-43b0-9aaa-3b94758598e4', //name: 'Tuval Employee',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('מנורה מבטחים פנס')) {
    return {
      business: 'af386033-a577-4c9a-880a-d49acd15141d', //name: 'מנורה פנסיה',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('פניקס אקסלנס')) {
    return {
      business: '1453f8d1-adae-4761-851b-83799290b8d1', //name: 'פניקס השתלמות',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('מיטב דש גמל ופנס')) {
    return {
      business: '340c3552-0a15-4e22-ba03-19ae9322859c', //name: 'איילון פנסיה',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('מגדל מקפת')) {
    return {
      business: 'fc2ea992-a2be-4f8a-a639-542a81276beb', //name: 'מגדל פנסיה',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('מגדל השתלמות')) {
    return {
      business: '2697dae8-cbd5-4669-8e80-d0964e5c077e', //name: 'מגדל השתלמות',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('ביטוח לאומי')) {
    return {
      business: '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', //name: 'Social Security Deductions',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('LANCE GLOBAL')) {
    return {
      business: '9c9f3979-08b1-453c-832a-d5eba2bba79a', //name: 'Lance Global Inc',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (
    (description.includes('העברת מט"ח') &&
      (description.includes('fbv') || description.includes('fv'))) ||
    description.includes('kamil kisiela')
  ) {
    return {
      business: 'f1749353-979b-46df-8931-93a3aafab1f4', //name: 'Jelly JS Kamil Kisiela',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('מס הכנסה')) {
    const flag = description.includes('מס הכנסה ני');
    return {
      beneficiaries: COMMON_BENEFICIARIES,
      business: flag
        ? 'f1ade516-4999-4919-9d94-6b013221536d' //name: 'Tax Deductions',
        : '9d3a8a88-6958-4119-b509-d50a7cdc0744', //name: 'Tax',
    };
  }
  if (description.includes('גורניצקי')) {
    return {
      business: 'fe11b834-c218-472b-a129-8ac296553258', //name: 'Gornitzky & Co., Advocates',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('המכס ומעמ-גביי תשלום') || description.includes('CUSTOM + V.A.T')) {
    return {
      business: 'c7fdf6f6-e075-44ee-b251-cbefea366826', //name: 'VAT',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('חניון')) {
    return {
      business: description.includes('אחוזות החוף')
        ? 'b51aeb4d-48ed-43e5-84a2-f12b6905fd51' //name: 'Ahuzot',
        : 'ed7b54f1-f695-4bc2-b8af-887e3115bfcc', //name: 'Parking',
    };
  }
  if (description.includes('ETANA')) {
    return {
      business: '73519067-c8fe-4073-aec6-608ff596f8a8', //name: 'The Graph Foundation',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('deel')) {
    return {
      business: '8d34f668-7233-4ce3-9c9c-82550b0839ff', //name: 'Deel Germany GmbH',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('GITHUB')) {
    const suggested = {
      business: 'af23ab30-5cf9-4433-abe1-14ae70ab64d7', //name: 'GitHub, Inc',
      beneficiaries: COMMON_BENEFICIARIES,
    };
    return suggested;
  }
  if (formatAmount(DbTransaction.amount) === -4329) {
    return {
      business: '8069311d-314e-4d1a-8f76-629757070ca0', //name: 'Avi Peretz',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('APPLE COM BILL/ITUNES.COM')) {
    return {
      business: '6346872a-708d-4910-9428-72019b053ea5', //name: 'Apple',
      taxCategory: 'אתר',
      beneficiaaries: [], // NOTE: used to be ' '
    };
  }
  if (
    description.includes('ע\' העברת מט"ח') ||
    (description.includes('העברת מט"ח') && Math.abs(formatAmount(DbTransaction.amount)) < 400) ||
    (description.includes('מטח') && Math.abs(formatAmount(DbTransaction.amount)) < 400) ||
    description.includes('F.C.COM') ||
    description.includes('ע.מפעולות-ישיר') ||
    description.includes('ריבית חובה') ||
    description.includes('FEE')
  ) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
    };
  }
  if (description.includes('ריבית זכות')) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
    };
  }
  if (description.includes('פועלים- דמי כרטיס')) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
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
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '737df651-8e02-40dd-b749-228bad16f279',
      description: `Software Development and Consulting ${previousMonth}/2023`,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('slava')) {
    return {
      business: '74c8b843-3819-44a0-abc6-730d4d829e9f', // SLAVA UKRAINI
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('COURIER PLUS INC')) {
    return {
      business: '74c8a4e0-ea3b-4906-a6b3-a868ee6d700d', // name: 'Courier Plus Inc DBA Dutchie'
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('GOBRANDS')) {
    return {
      business: '011dac15-1a48-447e-91f0-ef4344137caa', // name: 'GoBrands Inc'
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('MEDIC FIRST AI')) {
    return {
      business: 'dcb28428-6ba4-4ee3-94a9-ebd188c82822', // name: 'HSI Workplace Compliance Solutions, Inc'
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (formatAmount(DbTransaction.amount) === -12_000) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    return {
      business: 'd140fae3-f841-464c-84a7-c526c0123f36', //name: 'Saihajpreet Singh',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (formatAmount(DbTransaction.amount) === -600) {
    return {
      business: '02d467c9-0818-45e3-9a25-9f99d0101a9e', //name: 'ZAUM',
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }

  return null;
};

export const transactionSuggestionsResolvers: TransactionsModule.Resolvers = {
  // WireTransaction: {
  //   missingInfoSuggestions: missingInfoSuggestions as WireTransactionResolvers['missingInfoSuggestions'],
  // },
  // FeeTransaction: {
  //   missingInfoSuggestions: missingInfoSuggestions as FeeTransactionResolvers['missingInfoSuggestions'],
  // },
  ConversionTransaction: {
    missingInfoSuggestions:
      missingInfoSuggestions as TransactionResolvers['missingInfoSuggestions'],
  },
  CommonTransaction: {
    missingInfoSuggestions:
      missingInfoSuggestions as TransactionResolvers['missingInfoSuggestions'],
  },
};
