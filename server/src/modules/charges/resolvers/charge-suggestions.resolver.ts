import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  ChargeResolvers,
  Currency,
  Maybe,
  Resolver,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatAmount, formatFinancialAmount } from '@shared/helpers';
import type { ChargesModule } from '../types.js';

type SuggestionData = {
  beneficiaries?: Array<{ counterpartyID: string; percentage: number }>;
  description?: string;
  tags: Array<{
    name: string;
  }>;
  vat?: {
    __typename?: 'FinancialAmount' | undefined;
    currency: Currency;
    formatted: string;
    raw: number;
  };
  phrases: Array<string>;
  calculatedVat?: boolean;
};

type Suggestion = Omit<Awaited<ResolversTypes['ChargeSuggestions']>, 'business'> & {
  business: string;
};

function calculateVat(stringAmount: string | null) {
  return formatFinancialAmount((formatAmount(stringAmount) / 117) * 17);
}

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
  ResolversParentTypes['Charge'],
  GraphQLModules.Context
> = async (DbCharge, _, { injector }) => {
  // if all required fields are filled, no need for suggestions
  if (
    // DbCharge.counterparty_id &&
    !!DbCharge.tags?.length &&
    // DbCharge.financial_accounts_to_balance &&
    !!DbCharge.user_description?.trim()
  ) {
    return null;
  }

  // if charge has a businesses, use it's suggestion data
  if (DbCharge.business_id) {
    const business = await injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.load(DbCharge.business_id);
    if (business?.suggestion_data) {
      const suggestionData = business.suggestion_data as SuggestionData;

      return {
        business: business.id,
        description: suggestionData.description,
        beneficiaries: suggestionData.beneficiaries,
        tags: suggestionData.tags,
        vat: suggestionData.calculatedVat
          ? calculateVat(DbCharge.event_amount)
          : suggestionData.vat,
      };
    }
  }

  const allBusinesses = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();
  const suggestions: Record<string, Suggestion> = {};
  for (const business of allBusinesses) {
    if (!business.suggestion_data) continue;
    const suggestionData = business.suggestion_data as SuggestionData;

    if (business.id in (DbCharge.business_array ?? [])) {
      return {
        business: business.id,
        description: suggestionData.description,
        beneficiaries: suggestionData.beneficiaries,
        tags: suggestionData.tags,
        vat: suggestionData.calculatedVat
          ? calculateVat(DbCharge.event_amount)
          : suggestionData.vat,
      };
    }

    for (const phrase of suggestionData.phrases) {
      suggestions[phrase] = {
        business: business.id,
        description: suggestionData.description,
        beneficiaries: suggestionData.beneficiaries,
        tags: suggestionData.tags,
        vat: suggestionData.calculatedVat
          ? calculateVat(DbCharge.event_amount)
          : suggestionData.vat,
      };
    }
  }

  const transactions = await injector
    .get(TransactionsProvider)
    .getTransactionsByChargeIDLoader.load(DbCharge.id);
  const description = transactions.map(t => t.source_description).join(' ');

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
    (description.includes('העברת מט"ח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    (description.includes('מטח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    description.includes('F.C.COM') ||
    description.includes('ע.מפעולות-ישיר') ||
    description.includes('ריבית חובה') ||
    description.includes('FEE')
  ) {
    const sourceTransaction =
      transactions.length === 0
        ? 'Missing'
        : transactions.length === 1
          ? transactions[0].source_reference
          : `['${transactions.map(t => t.source_reference).join("','")}']`;
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      tags: [{ name: 'financial' }],
      description: `Fees for source transaction=${sourceTransaction}`,
    };
  }
  if (description.includes('דותן שמחה') || description.includes('שמחה דותן')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df', //name: 'Dotan Employee',
      description: `${previousMonth}/2022 Salary`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 1,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('גולדשטין אורי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: '7843b805-3bb7-4d1c-9219-ff783100334b', //name: 'Uri Employee',
      description: `${previousMonth}/2022 Salary`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 1,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('גרדוש')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'f4b591f3-d817-4e3d-9ecb-35b38d2df7ef', //name: 'Gil Employee',
      description: `${previousMonth}/2022 Salary`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('תובל')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: '4420accf-da13-43b0-9aaa-3b94758598e4', //name: 'Tuval Employee',
      description: `${previousMonth}/2022 Salary`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מנורה מבטחים פנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'af386033-a577-4c9a-880a-d49acd15141d', //name: 'מנורה פנסיה',
      description: `Pension ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('פניקס אקסלנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: '1453f8d1-adae-4761-851b-83799290b8d1', //name: 'פניקס השתלמות',
      description: `Training Fund ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מיטב דש גמל ופנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: '340c3552-0a15-4e22-ba03-19ae9322859c', //name: 'איילון פנסיה',
      description: `Pension ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מגדל מקפת')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'fc2ea992-a2be-4f8a-a639-542a81276beb', //name: 'מגדל פנסיה',
      description: `Pension ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מגדל השתלמות')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: '2697dae8-cbd5-4669-8e80-d0964e5c077e', //name: 'מגדל השתלמות',
      description: `Training Fund ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('ביטוח לאומי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', //name: 'Social Security Deductions',
      description: `Social Security Deductions for Salaries ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('LANCE GLOBAL')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      business: '9c9f3979-08b1-453c-832a-d5eba2bba79a', //name: 'Lance Global Inc',
      description: `The Guild Enterprise Support - ${previousMonth} 2022`,
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
  }
  if (
    (description.includes('העברת מט"ח') &&
      (description.includes('fbv') || description.includes('fv'))) ||
    description.includes('kamil kisiela')
  ) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'f1749353-979b-46df-8931-93a3aafab1f4', //name: 'Jelly JS Kamil Kisiela',
      description: `Software Development and Consulting ${previousMonth}/23`,
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('slava')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '74c8b843-3819-44a0-abc6-730d4d829e9f', // name: 'SLAVA UKRAINI'
      description: `Web Development Services ${previousMonth}/23`,
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('COURIER PLUS INC')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      business: '74c8a4e0-ea3b-4906-a6b3-a868ee6d700d', // name: 'Courier Plus Inc DBA Dutchie'
      description: `GraphQL Hive Enterprise License - ${previousMonth} 2023`,
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('GOBRANDS')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      business: '011dac15-1a48-447e-91f0-ef4344137caa', // name: 'GoBrands Inc'
      description: `GraphQL Hive Enterprise License - ${previousMonth} 2023`,
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('MEDIC FIRST AI')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      business: 'dcb28428-6ba4-4ee3-94a9-ebd188c82822', // name: 'HSI Workplace Compliance Solutions, Inc'
      description: `GraphQL Hive Enterprise License - ${previousMonth} 2023`,
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('מס הכנסה')) {
    const flag = description.includes('מס הכנסה ני');
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
      business: flag
        ? 'f1ade516-4999-4919-9d94-6b013221536d' //name: 'Tax Deductions',
        : '9d3a8a88-6958-4119-b509-d50a7cdc0744', //name: 'Tax',
      description: flag
        ? `Tax for employees for ${previousMonth}/2022`
        : `Advance Tax for ${previousMonth}/2022`,
    };
  }
  if (description.includes('גורניצקי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'fe11b834-c218-472b-a129-8ac296553258', //name: 'Gornitzky & Co., Advocates',
      description: `${previousMonth}/2022 lawyer support`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('המכס ומעמ-גביי תשלום') || description.includes('CUSTOM + V.A.T')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      business: 'c7fdf6f6-e075-44ee-b251-cbefea366826', //name: 'VAT',
      description: `VAT for ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('חניון')) {
    return {
      business: description.includes('אחוזות החוף')
        ? 'b51aeb4d-48ed-43e5-84a2-f12b6905fd51' //name: 'Ahuzot',
        : 'ed7b54f1-f695-4bc2-b8af-887e3115bfcc', //name: 'Parking',
      description: 'Parking',
      tags: [{ name: 'transportation' }],
    };
  }
  if (description.includes('ETANA')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      business: '73519067-c8fe-4073-aec6-608ff596f8a8', //name: 'The Graph Foundation',
      description: `The Guild Enterprise Support - ${previousMonth} 2022`,
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('deel')) {
    return {
      business: '8d34f668-7233-4ce3-9c9c-82550b0839ff', //name: 'Deel Germany GmbH',
      description: 'Laurin Salary',
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('GITHUB')) {
    const suggested = {
      business: 'af23ab30-5cf9-4433-abe1-14ae70ab64d7', //name: 'GitHub, Inc',
      description: 'GitHub Actions',
      beneficiaries: COMMON_BENEFICIARIES,
      tags: [{ name: 'business' }],
    };
    if (formatAmount(DbCharge.event_amount) <= -2100) {
      suggested.description = 'Monthly Sponsor for Andaris, notrab, warrenday';
    } else if (formatAmount(DbCharge.event_amount) <= -2000) {
      suggested.description = 'Monthly Sponsor for Benjie, Code-Hex, hayes';
    } else {
      suggested.description = 'GitHub Actions';
    }
    return suggested;
  }
  if (formatAmount(DbCharge.event_amount) === -4329) {
    return {
      business: '8069311d-314e-4d1a-8f76-629757070ca0', //name: 'Avi Peretz',
      description: 'Office rent',
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }
  if (description.includes('APPLE COM BILL/ITUNES.COM')) {
    const flag = formatAmount(DbCharge.event_amount) === -109.9;
    return {
      business: '6346872a-708d-4910-9428-72019b053ea5', //name: 'Apple',
      taxCategory: 'אתר',
      beneficiaaries: [], // NOTE: used to be ' '
      vat: formatFinancialAmount(0),
      description: flag ? 'LinkedIn' : 'Apple Services',
      tags: [{ name: flag ? 'business' : 'computer' }],
    };
  }
  if (
    description.includes('ע\' העברת מט"ח') ||
    (description.includes('העברת מט"ח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    (description.includes('מטח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    description.includes('F.C.COM') ||
    description.includes('ע.מפעולות-ישיר') ||
    description.includes('ריבית חובה') ||
    description.includes('FEE')
  ) {
    //NOTE: multiple suggestions business
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      tags: [{ name: 'financial' }],
      description: `Fees for bank_reference=${transactions[0].source_reference ?? 'Missing'}`,
    };
  }
  if (description.includes('ריבית זכות')) {
    //NOTE: multiple suggestions business
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      description: 'Interest fees on Euro plus',
      tags: [{ name: 'financial' }],
    };
  }
  if (description.includes('פועלים- דמי כרטיס')) {
    //NOTE: multiple suggestions business
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      description: 'Bank creditcard fees',
      tags: [{ name: 'financial' }],
    };
  }
  if (description.includes('אריה קריסטל')) {
    //NOTE: multiple suggestions business
    return {
      business: '245e149b-b328-471f-9e11-bdaa10dc5fb7', //name: 'Arye Kristal',
      description: 'Water bill for 04-2022',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('aleksandra')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'b001b503-93ce-497c-bb6c-1c5f1eb6b776', //name: 'ALEKSANDRA MONWID-OLECHNOWICZ'
      description: `Software Consulting Fees (${previousMonth}/2023)`,
      tags: [{ name: 'business' }],
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
  if (formatAmount(DbCharge.event_amount) === -12_000) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'd140fae3-f841-464c-84a7-c526c0123f36', //name: 'Saihajpreet Singh',
      beneficiaries: COMMON_BENEFICIARIES,
      description: `${previousMonth}/2022`,
      tags: [{ name: 'business' }],
    };
  }
  if (formatAmount(DbCharge.event_amount) === -600) {
    return {
      business: '02d467c9-0818-45e3-9a25-9f99d0101a9e', //name: 'ZAUM',
      description: 'Matic Zavadlal - April 2021',
      tags: [{ name: 'business' }],
      beneficiaries: COMMON_BENEFICIARIES,
    };
  }

  return null;
};

const commonChargeFields: ChargesModule.ChargeResolvers = {
  missingInfoSuggestions: missingInfoSuggestions as ChargeResolvers['missingInfoSuggestions'],
};

export const chargeSuggestionsResolvers: ChargesModule.Resolvers = {
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
};
