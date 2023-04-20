import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  ChargeResolvers,
  Maybe,
  Resolver,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatAmount, formatFinancialAmount } from '@shared/helpers';
import type { ChargesModule } from '../types.js';

const missingInfoSuggestions: Resolver<
  Maybe<Omit<ResolversTypes['ChargeSuggestions'], 'business'> & { business: string }>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context
> = async (DbCharge, _, { injector }) => {
  if (
    // TODO (Gil): Re-enable tags after migration to new DB structure
    // DbCharge.counterparty_id &&
    // TODO (Gil): Re-enable tags after migration to new DB structure
    // DbCharge.personal_category &&
    DbCharge.documents_vat_amount != null &&
    // DbCharge.financial_accounts_to_balance &&
    !!DbCharge.user_description?.trim()
  ) {
    return null;
  }
  const transactions = await injector
    .get(TransactionsProvider)
    .getTransactionsByChargeIDLoader.load(DbCharge.id);
  const description = transactions.map(t => t.source_description).join(' ');

  if (description.includes('SLACK TAYJ1FSUA/DUBLIN')) {
    return {
      business: '891b815f-f650-4b99-a979-caeada49bc05', //name: 'Slack',
      description: 'Slack',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('CLOUDFLARE')) {
    return {
      business: 'bf500365-9aef-4f87-8169-4210f6d4cdb4', //name: 'Cloudflare, Inc.',
      description: 'Web Hosting',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('CLICKHOUSE')) {
    return {
      business: '8aff74ea-5fc8-4241-b700-eeacf9873977', //name: 'ClickHouse, Inc.',
      description: 'DB Hosting',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('WOLT')) {
    return {
      business: '8e94b4fa-69a4-44b6-b160-af23effa1412', //name: 'Wolt',
      description: 'Wolt',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('שטראוס מים')) {
    return {
      business: '65fc90ff-ee3a-4fe3-8aff-15ff46c2721e', //name: 'Tami4',
      description: 'Water',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('חומוס פול התימני')) {
    return {
      business: '56c42208-a090-49fc-a0f7-bcb9dababd20', //name: 'חומוס פול התימני',
      description: 'Food',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('אי אם פי אם') || description.includes('איי.אם.פי.אם')) {
    return {
      business: 'a989aab2-3677-406d-9477-b5053393c357', //name: 'AmPm',
      description: 'Groceries',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('סופר יודה')) {
    return {
      business: '645f1069-f1bd-45d4-bfac-d7462ed38344', //name: 'סופר יודה',
      description: 'Groceries',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('הצרכניה-צמרת')) {
    return {
      business: '56489617-41c6-4856-bd79-8d4a1961605d', //name: 'הצרכניה-צמרת',
      description: 'Groceries',
      tags: [{ name: 'food' }],
    };
  }
  if (
    description.includes('מטח-קניה') ||
    description.includes('רכישת מט"ח') ||
    description.includes('מטח-מכירה') ||
    description.includes('המרת מט"ח') ||
    description.includes('קונברסיה') ||
    description.includes('חליפין')
  ) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      tags: [{ name: 'conversion' }],
    };
  }
  if (description.includes('חשבונית ירוקה')) {
    return {
      business: 'eff4c404-67e8-42c1-9212-022c137cf31a', //name: 'Green Invoice',
      description: 'Green Invoice Monthly Charge',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
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
    const sourceTransaction =
      transactions.length === 0
        ? 'Missing'
        : transactions.length === 1
        ? transactions[0].id
        : `['${transactions.map(t => t.id).join("','")}']`;
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      tags: [{ name: 'financial' }],
      description: `Fees for source transaction=${sourceTransaction}`,
    };
  }
  if (description.includes('ריבית זכות')) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      description: 'Interest fees on Euro plus',
      tags: [{ name: 'financial' }],
    };
  }
  if (description.includes('י.י. יעוץ והשקעות')) {
    return {
      business: 'b9deb54c-ece9-483d-9c3c-b4ac7b2e516f', //name: 'Yossi Yaron',
      description: 'Tax benefits consultation',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('דותן שמחה') || description.includes('שמחה דותן')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
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
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
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
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'f4b591f3-d817-4e3d-9ecb-35b38d2df7ef', //name: 'Gil Employee',
      description: `${previousMonth}/2022 Salary`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('גלעד תדהר')) {
    return {
      business: '855fd0ef-5fd1-4287-b391-db00b9f87ede', //name: 'Gilad Employee',
      description: '02/2022 Salary',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('תובל')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '4420accf-da13-43b0-9aaa-3b94758598e4', //name: 'Tuval Employee',
      description: `${previousMonth}/2022 Salary`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מנורה מבטחים פנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'af386033-a577-4c9a-880a-d49acd15141d', //name: 'מנורה פנסיה',
      description: `Pension ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('פניקס אקסלנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '1453f8d1-adae-4761-851b-83799290b8d1', //name: 'פניקס השתלמות',
      description: `Training Fund ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מיטב דש גמל ופנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '340c3552-0a15-4e22-ba03-19ae9322859c', //name: 'איילון פנסיה',
      description: `Pension ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מגדל מקפת')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'fc2ea992-a2be-4f8a-a639-542a81276beb', //name: 'מגדל פנסיה',
      description: `Pension ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('מגדל השתלמות')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '2697dae8-cbd5-4669-8e80-d0964e5c077e', //name: 'מגדל השתלמות',
      description: `Training Fund ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  //   if (
  //     description.includes('הוט נט שרותי אינטרנט') ||
  //     description.includes('HOT')
  //   ) {
  //     return {
  //       business: {
  //         '5f1b96f7-bb4d-4e8c-91ed-7c488fef9efe'//name: 'HOT',
  //       description: `Internet Provider`,
  //       tags: [{ name: 'computer' }],
  //     };
  //   }
  if (description.includes('סלקום')) {
    return {
      business: '2e5ed89b-5ddb-4b56-b042-804e44d4802d', //name: 'Celcom',
      description: 'Internet Provider',
      tags: [{ name: 'computer' }],
    };
  }
  if (description.includes('יורוקארד') || description.includes('ISRACARD')) {
    return {
      business: '96dba127-90f4-4407-ae89-5a53afa42ca3', //name: 'Isracard',
      description: 'Creditcard charge',
      tags: [{ name: 'creditcard' }],
    };
  }
  if (description.includes('MEETUP')) {
    return {
      business: '44f70d97-9b89-45e6-984f-f78752ca59f3', //name: 'Meetup',
      description: 'Meetup Monthly charge',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('ביטוח לאומי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', //name: 'Social Security Deductions',
      description: `Social Security Deductions for Salaries ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('HOT MOBILE')) {
    return {
      business: 'a3cd6995-b487-49f7-be5d-bab32923037a', //name: 'Hot Mobile',
      description: 'Hot Mobile Monthly charge',
      taxCategory: 'פלאפון',
      beneficiaaries: [], // NOTE: used to be ' '
      tags: [{ name: 'communications' }],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('GITHUB')) {
    const suggested = {
      business: 'af23ab30-5cf9-4433-abe1-14ae70ab64d7', //name: 'GitHub, Inc',
      description: 'GitHub Actions',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ] as const,
      tags: [{ name: 'business' }],
    };
    if (formatAmount(DbCharge.event_amount) <= -450) {
      suggested.description = 'Monthly Sponsor for Yaacov and Benjie';
    } else if (formatAmount(DbCharge.event_amount) == -4) {
      suggested.description = 'GitHub CI charges';
    }
    return suggested;
  }
  if (description.includes('גילדה למוצרי תוכנה')) {
    return {
      business: '6a20aa69-57ff-446e-8d6a-1e96d095e988', //name: 'Software Products Guilda Ltd.',
      description: 'The Guild work',
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('אורי גולדשטיין בע')) {
    return {
      business: 'a1f66c23-cea3-48a8-9a4b-0b4a0422851a', //name: 'Uri Goldshtein LTD',
      description: 'Transaction to company',
      tags: [{ name: 'business' }],
    };
  }
  if (formatAmount(DbCharge.event_amount) == -4329) {
    return {
      business: '8069311d-314e-4d1a-8f76-629757070ca0', //name: 'Avi Peretz',
      description: 'Office rent',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('פיוז אוטוטק')) {
    return {
      business: 'd491f2bd-8ea9-4ef5-8eda-8b8c59974676', //name: 'פיוז אוטוטק בעמ',
      description: 'The Guild Enterprise Support 02/22',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('ט.מ.ל מערכות')) {
    return {
      business: '385215de-69ce-4da6-8173-b50def69d2ce', //name: 'Tamal',
      description: 'Salary software',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('רשם החברות')) {
    return {
      business: '02952f36-1201-4fd3-a0ef-6cfc064e3985', //name: 'מ.המשפטים-רשם החברות',
      description: 'Company registration yearly fee',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('פועלים- דמי כרטיס')) {
    return {
      business: '8fa16264-de32-4592-bffb-64a1914318ad', //name: 'Poalim',
      description: 'Bank creditcard fees',
      tags: [{ name: 'financial' }],
    };
  }
  // NOTE: Monitor business doesn't exist
  //   if (description.includes('מוניטור')) {
  //     return {
  //       financialEntity: 'Monitor',
  //       business: '8fa16264-de32-4592-bffb-64a1914318ad' //name: 'Poalim',
  //       description: 'Personal Finance App',
  //       tags: [{ name: 'financial' }],
  //     };
  //   }
  if (description.includes('G.CO')) {
    return {
      business: 'fc8fd6d4-ce92-478e-a64c-cf588024e34f', //name: 'Google Fi',
      description: 'Google Fi',
      beneficiaaries: [], // NOTE: used to be ' '
      tags: [{ name: 'communications' }],
    };
  }
  if (description.includes('ארומה')) {
    return {
      business: 'bf354b84-b866-4e7e-af40-50f546a33309', //name: 'Aroma',
      description: 'Coffee',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('פפואה')) {
    return {
      business: 'b62ba5ed-5a45-48aa-95bd-ac2dcbacb685', //name: 'פפואה',
      description: 'Coffee',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('סופר פארם')) {
    return {
      business: '4573516a-df09-4d07-b06b-34fd867829ab', //name: 'SuperPharm',
      description: 'Personal care',
      tags: [{ name: 'health' }],
    };
  }
  if (description.includes('חברת פרטנר תקשורת בע')) {
    return {
      business: '7ada0a12-39e1-4096-99d2-34c8b3fa0469', //name: 'Partner',
      tags: [{ name: 'family' }],
    };
  }
  if (description.includes('העברה מחו"ל') && description.includes('SDI PROCUREMEN')) {
    return {
      business: '6390c250-0848-4830-9e09-8444e0a1f360', //name: 'sdi procurement solutions',
      taxCategory: 'הכנפט1',
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('ZOOM')) {
    return {
      business: '5ec1b895-3375-4a1f-80d7-894d873723a0', //name: 'Zoom',
      description: 'Zoom for therapy',
      taxCategory: 'אתר',
      beneficiaaries: [], // NOTE: used to be ' '
      tags: [{ name: 'love' }],
    };
  }
  if (description.includes('MOUNTAIN V') || description.includes('STORA')) {
    return {
      business: '1d3d1427-2a38-4d43-a4ea-90385b0273e2', //name: 'Google Storage',
      description: 'Google Storage',
      taxCategory: 'אתר',
      beneficiaaries: [], // NOTE: used to be ' '
      tags: [{ name: 'computer' }],
    };
  }
  if (description.includes('APPLE COM BILL/ITUNES.COM')) {
    const flag = formatAmount(DbCharge.event_amount) == -109.9;
    return {
      business: '6346872a-708d-4910-9428-72019b053ea5', //name: 'Apple',
      taxCategory: 'אתר',
      beneficiaaries: [], // NOTE: used to be ' '
      vat: formatFinancialAmount(0),
      description: flag ? 'LinkedIn' : 'Apple Services',
      tags: [{ name: flag ? 'business' : 'computer' }],
    };
  }
  if (description.includes('GETT')) {
    return {
      business: '083c6e2e-b4c3-46a7-b918-a00b8d6eae91', //name: 'Gett',
      description: 'Taxi',
      beneficiaaries: [], // NOTE: used to be ' '
      tags: [{ name: 'transportation' }],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('סונול')) {
    return {
      business: '0e8f709b-c30c-4575-a228-1d9a5fd7f30e', //name: 'Sonol',
      description: 'Gas',
      tags: [{ name: 'transportation' }],
    };
  }
  if (description.includes('אלון')) {
    return {
      business: 'f5daf0af-ad40-46d0-94c2-2603f0d20035', //name: 'Alon',
      description: 'Gas',
      tags: [{ name: 'transportation' }],
    };
  }
  if (description.includes('קאר 2 גו')) {
    return {
      business: 'fbc73635-3b8b-4d40-9d29-0ddf8a999049', //name: 'קאר 2 גו',
      description: 'Car rental',
      tags: [{ name: 'transportation' }],
    };
  }
  if (description.includes('CARPOOL')) {
    return {
      business: 'd02e668d-4c13-4fd7-8388-104da05e7ca3', //name: 'Google Waze',
      description: 'Waze Carpool',
      tags: [{ name: 'transportation' }],
    };
  }
  if (description.includes('UBER')) {
    return {
      business: '793056f9-df28-44e4-a163-495494a76e3b', //name: 'Uber',
      description: 'Taxi',
      tags: [{ name: 'transportation' }],
    };
  }
  if (description.includes('ZAPIER')) {
    return {
      business: 'e45f5129-d9f1-4bb7-b3de-01c7110b7d5f', //name: 'Zapier Inc.',
      description: 'Zapier monthly charge',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('NOTION')) {
    return {
      business: '7b429e58-7d70-4465-a312-4ec60f23303f', //name: 'Notion Labs, Inc',
      description: 'Notion monthly charge',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('ALTINITY')) {
    return {
      business: '492469d7-c071-4b54-b380-a0403ac3db8d', //name: 'Altinity Inc',
      description: 'ALTINITY DB Hosting',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('PULUMI')) {
    return {
      business: 'b20f4049-cb99-45d6-87bb-19bf700235e0', //name: 'Pulumi Corporation',
      description: 'Infrastructure Hosting',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('קרן מכבי- חיוב')) {
    return {
      business: '64d175f5-fbb9-4687-8ef2-96c988e4b72e', //name: 'Maccabi',
      description: 'Monthly health bill',
      tags: [{ name: 'health' }],
    };
  }
  // NOTE: business ATHLETIC TRUTH GROUP is not in the system
  //   if (description.includes('ATHLETIC TRUTH GROUP')) {
  //     return {
  //       financialEntity: 'ATHLETIC TRUTH GROUP',
  //       description: 'Sports App',
  //       tags: [{ name: 'health' }],
  //     };
  //   }
  if (description.includes('MSFT AZURE')) {
    return {
      business: 'a60ccf22-a666-4419-9f69-d84eb2af7e42', //name: 'Microsoft Azure',
      description: 'Infrastructure',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('AWS EMEA')) {
    return {
      business: '3f153276-8367-47f4-97ea-e92ba4be3e4e', //name: 'Amazon Web Services EMEA SARL',
      description: 'Infrastructure',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('שיק שיק')) {
    return {
      business: '245e149b-b328-471f-9e11-bdaa10dc5fb7', //name: 'Arye Kristal',
      description: 'House rent',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('BEEHIIV')) {
    return {
      business: '09d5fafa-aca8-470a-925a-45fd9ea6f27c', //name: 'beehiiv',
      description: 'Newsletter service',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('POSTMARKAPP')) {
    return {
      business: '5a8b588e-4604-4a2b-b209-b86822431a40', //name: 'ActiveCampaign, LLC',
      description: 'Email Service',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('LOOM')) {
    return {
      business: 'ce4ab5fe-79e4-463c-904c-5b2fec7be4b2', //name: 'Loom, Inc',
      description: 'Video recording for business',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes("ג'אסט לאנס")) {
    return {
      business: '30a9243d-9f95-4a67-a023-9a965d25c840', //name: 'JustLance LTD',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('LANCE GLOBAL')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      business: '9c9f3979-08b1-453c-832a-d5eba2bba79a', //name: 'Lance Global Inc',
      description: `The Guild Enterprise Support - ${previousMonth} 2022`,
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('CRISP')) {
    return {
      business: 'a6b58ace-3f53-4971-8dcf-d606f4a5d367', //name: 'Crisp IM SARL',
      description: 'Monthly Crisp',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('VERCEL')) {
    return {
      business: '5b7b0977-2c6f-4b26-93d9-d90c1698edcc', //name: 'Vercel Inc.',
      description: 'Vercel Hosting',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('RETOOL')) {
    return {
      business: 'bfe7ba3d-ff20-4f2a-8ece-6aa369b110af', //name: 'Retool Inc',
      description: 'Retool',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('הוק האוס אוף קופי')) {
    return {
      business: 'e11a082f-eda0-4dbf-8ed4-098aea266768', //name: 'HOC - House Of Coffee',
      description: 'Coffee',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('מנטנטו')) {
    return {
      business: '525cf268-0837-4ff2-8af4-3937425b8a27', //name: 'Men Tenten Ramen Bar',
      description: 'Food',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('משק ברזילי בע"מ')) {
    return {
      business: 'fe98bc42-2950-43f4-8a47-4ff6bb15e8a4', //name: 'Meshek Barzilay',
      description: 'Food',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('טל יהלום')) {
    return {
      business: 'd82782cf-f0ac-412d-b75f-d8c420cb3ff1', //name: 'Tal Yahalom',
      description: 'gift',
      tags: [{ name: 'family' }],
    };
  }
  if (description.includes('רוני שפירא')) {
    return {
      business: '085bcae7-7e79-4153-be64-a1adb3d7c002', //name: 'Roney Shapira',
      description: 'gift',
      tags: [{ name: 'family' }],
    };
  }
  if (description.includes('הלמן-אלדובי') && description.includes('השתלמות')) {
    return {
      business: '0117c1b0-c1f3-4564-9bc5-bdc27a8895f0', //name: 'Halman Aldubi Training Fund',
      beneficiaries: [], // NOTE: used to be 'training_fund',
      tags: [{ name: 'investments' }],
    };
  }
  if (description.includes('הלמן-אלדובי') && description.includes('קרן')) {
    return {
      business: 'd57ff56d-08ef-454b-88e9-37c4e9d0328c', //name: 'Halman Aldubi Pension',
      beneficiaries: [], // NOTE: used to be 'pension'
      tags: [{ name: 'investments' }],
    };
  }
  if (description.includes('PAYPER')) {
    return {
      business: '23fd0f9b-01ed-4677-80c3-8d547813a953', //name: 'Payper',
      description: 'Invoice Management Software',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (
    description.includes('העברת מט"ח') &&
    (description.includes('fbv') || description.includes('fv'))
  ) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'f1749353-979b-46df-8931-93a3aafab1f4', //name: 'Jelly JS Kamil Kisiela',
      description: `${previousMonth}/22`,
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (formatAmount(DbCharge.event_amount) == -12_000) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'd140fae3-f841-464c-84a7-c526c0123f36', //name: 'Saihajpreet Singh',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      description: `${previousMonth}/2022`,
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('Vignesh')) {
    return {
      business: 'a07f0014-7b97-4b18-9338-4097dcc9412d', //name: 'Vignesh T.V.',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('sof0')) {
    return {
      business: 'a33448fc-271c-4d20-b6e8-f6245dfadfeb', //name: 'LaunchMade Web Services',
      description: 'Jamie Barton',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
    };
  }
  if (description.includes('Steinbock Software LTD')) {
    return {
      business: 'd469d98f-e92b-4f9b-882f-767f6a4b4a11', //name: 'Steinbock Software LTD',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      tags: [{ name: 'business' }],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('מס הכנסה')) {
    const flag = description.includes('מס הכנסה ני');
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
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
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'fe11b834-c218-472b-a129-8ac296553258', //name: 'Gornitzky & Co., Advocates',
      description: `${previousMonth}/2022 lawyer support`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('המכס ומעמ-גביי תשלום') || description.includes('CUSTOM + V.A.T')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: 'c7fdf6f6-e075-44ee-b251-cbefea366826', //name: 'VAT',
      description: `VAT for ${previousMonth}/2022`,
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('מטרי')) {
    return {
      business: 'a31f1dea-270f-4d32-b47a-68bc55b22ecc', //name: 'Yaacov Matri',
      description: 'Consulting',
      tags: [{ name: 'learn' }],
      beneficiaaries: [], // NOTE: used to be ' '
      taxCategory: 'יעוץ',
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('יפה צדוק')) {
    return {
      business: 'd462adc2-6ddc-41a2-93b0-9436387cb90f', //name: 'Yaffa Tsadoc',
      description: 'Consulting',
      tags: [{ name: 'learn' }],
      beneficiaaries: [], // NOTE: used to be ' '
      taxCategory: 'יעוץ',
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('HEROKU')) {
    return {
      business: '5f05b909-bb88-4185-abaa-d3acdbf09808', //name: 'Heroku',
      description: 'accounter DB',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('RAINTANK INC') || description.includes('GRAFANA')) {
    return {
      business: '6827bdbd-5176-46b5-aa32-5ece1bf4a0c7', //name: 'Raintank Inc dba Grafana Labs',
      description: 'Grafana Cloud',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('JETBRAINS')) {
    return {
      business: 'cbc6a545-d6a3-4f56-96c0-51002454a735', //name: 'JetBrains',
      description: 'DataGrip',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('RESCUETIME')) {
    return {
      business: '37c40b38-b000-4ed1-8884-0fa1c7d64e99', //name: 'RescueTime',
      description: 'Time software',
      tags: [{ name: 'computer' }],
      beneficiaaries: [], // NOTE: used to be ' '
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
  if (description.includes('גיא אברהם')) {
    return {
      business: '88e77191-0721-40ae-8688-654b3a02b0fd', //name: 'Guy Avraham LTD',
      description: 'Wix Hashavshevet project',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('חשבשבת')) {
    return {
      business: '8efb0840-df6f-416d-af66-4953df8d14d5', //name: 'Hashavshevet',
      description: 'Accounting app',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('יהל-מור')) {
    return {
      business: 'ba57f515-03ff-40bc-952d-6c701ee6a099', //name: 'Yahel Mor',
      description: 'Bookkeeping with Narkis',
      tags: [{ name: 'business' }],
      taxCategory: 'הנחש',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('רווה רביד')) {
    return {
      business: '61b43877-ece1-4e2f-8f63-ec3cc1a13a43', //name: 'Raveh Ravid & Co',
      description: 'Accountants',
      tags: [{ name: 'business' }],
      taxCategory: 'הנחש',
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('GODADDY')) {
    return {
      business: 'c71f0cf4-43e4-4567-b646-799ccb72c91c', //name: 'GoDaddy',
      description: 'Domain',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('AHREFS')) {
    return {
      business: 'a7a93796-0b53-41cf-8f9d-c0d11ee8eb24', //name: 'Ahrefs Pte. Ltd.',
      description: 'Websites SEO',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount(0),
    };
  }
  if (description.includes('DALET DIGITAL')) {
    return {
      business: 'a3f4985e-1164-4a20-b9d5-b4169c47ead3', //name: 'Dalet Digital Media Systems USA Inc',
      description: 'Advance Payment - March',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
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
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('OUTREACH')) {
    return {
      business: 'cab41f1c-157d-4535-be70-21167fd4edc0', //name: 'Outreach Corporation',
      description: 'Apollo GraphQL server (aka Giraffe) improvements in Outreach - 1st month',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('ard')) {
    return {
      business: '8125698d-de35-4e0a-8896-fccc57c13a69', //name: 'Arda Tanrikulu',
      description: 'Payment for February 2021',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('deel')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    // const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      business: '8d34f668-7233-4ce3-9c9c-82550b0839ff', //name: 'Deel Germany GmbH',
      description: 'Laurin Salary',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('עידן')) {
    return {
      business: '0954cf17-4741-4354-bc38-ceee6364e598', //name: 'Idan Am-Shalem',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('מועדון הבלוק')) {
    return {
      business: 'd2c0045b-95f9-41de-9008-255e8793007e', //name: 'The Block',
      description: 'Party',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('chillz')) {
    return {
      business: 'ebfd52d3-f38e-4a59-8c42-7f831f3046ed', //name: 'chillz',
      description: 'Party',
      tags: [{ name: 'fun' }],
    };
  }
  // NOTE: business מייקו הגשמה בעמ is not in the DB
  //   if (description.includes('הגשמה')) {
  //     return {
  //       financialEntity: 'מייקו הגשמה בעמ',
  //       description: 'Party',
  //       tags: [{ name: 'fun' }],
  //     };
  //   }
  // NOTE: business המרץ2 תיאטרון is not in the DB
  //   if (description.includes('המרץ2 תיאטרון')) {
  //     return {
  //       financialEntity: 'המרץ2 תיאטרון',
  //       description: 'Party',
  //       tags: [{ name: 'fun' }],
  //     };
  //   }
  if (description.includes('EVENTBUZZ TICKETS') || description.includes('איבנטבאז')) {
    return {
      business: '8d5141fd-5f5f-48f8-98f4-095e4889e278', //name: 'EVENTBUZZ TICKETS',
      description: 'Party',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('סלון ברלין')) {
    return {
      business: 'e5fff596-d62a-4b2d-961c-e8b5f86a0da9', //name: 'סלון ברלין',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('סילון')) {
    return {
      business: '334c8245-e915-4beb-a613-97ac530790cf', //name: 'סילון',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('גוגיס')) {
    return {
      business: '13cd79fb-ed3c-458a-b6d0-5b08cc7834d4', //name: 'גוגיס',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('אלברט 1943')) {
    return {
      business: 'e5bf3640-4308-41d4-982c-053c99a87b02', //name: 'אלברט 1943',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('223')) {
    return {
      business: 'bb34dbcc-16e2-4da0-b531-ed7c05fbc3a4', //name: '223 Bar',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('רמפה')) {
    return {
      business: 'db3b05dd-a444-480a-9ec4-9f06bde047c8', //name: 'Ala Rampa',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('K-BAR')) {
    return {
      business: '170f75e0-2c4d-438e-9729-39553cf453e9', //name: 'K BAR',
      description: 'Bar',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('NETFLIX')) {
    return {
      business: 'cdf7b1f2-366f-4fcb-9f84-910a5bf741d8', //name: 'Netflix',
      description: 'TV',
      tags: [{ name: 'fun' }],
    };
  }
  if (description.includes('תורגמן יצחק ואברהם')) {
    return {
      business: 'fd308f3a-2bb0-468e-8243-f362ac072957', //name: 'תורגמן יצחק ואברהם',
      description: 'טמבוריה',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('אריה קריסטל')) {
    return {
      business: '245e149b-b328-471f-9e11-bdaa10dc5fb7', //name: 'Arye Kristal',
      description: 'Water bill for 04-2022',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('קאופמן מנעולים')) {
    return {
      business: '567191ed-4e55-4fcb-ba14-ba98e35ddbc3', //name: 'קאופמן מנעולים',
      description: 'טמבוריה',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes("חב' חשמל דן חשבונות")) {
    return {
      business: '9bf2a192-a31f-4b13-9cb7-ffb6e9430be1', //name: 'חב חשמל דן חשבונות',
      description: 'Electricity bill',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('עיריית תל אביב יפו א')) {
    return {
      business: '22eec5bb-88a7-4513-a3f6-b73da21e9111', //name: 'Tel Aviv Municipality',
      description: 'Arnona',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('EUFYLIFE')) {
    return {
      business: 'c4bc6172-8fff-4c01-bc45-6a7b38020311', //name: 'Eufy',
      description: 'Home Camera',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('NAME COM')) {
    return {
      business: '4cfc08d5-a4c3-4d12-8a63-b4cadc9d7061', //name: 'NAME COM',
      description: 'Domain',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('SENTRY')) {
    return {
      business: '80690926-5f4e-4a37-947b-92a66b699956', //name: 'Sentry',
      description: 'Monitoring',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('RENDER')) {
    return {
      business: '06f222ab-d304-4610-b51a-1dd9132ef6df', //name: 'Render',
      description: 'Hosting',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('ELASTIC')) {
    return {
      business: '13e86132-f2c5-482f-b3f7-e99d14d4e38c', //name: 'Elasticsearch AS',
      description: 'Hive storage',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('GSUITE') || description.includes('GOOGLE CLOUD')) {
    return {
      business: 'f989d32b-089f-4418-9966-fbb478576fbe', //name: 'Google Ireland Limited',
      description: 'G Suite for The Guild',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('רב-פס')) {
    return {
      business: 'dff879e8-cafd-4ca1-af4c-d1d9974e50f0', //name: 'רב-פס',
      description: 'Bus tickets',
      tags: [{ name: 'transportation' }],
      beneficiaaries: [], // NOTE: used to be ' '
      taxCategory: 'נסע',
      vat: formatFinancialAmount((formatAmount(DbCharge.event_amount) / 117) * 17),
    };
  }
  if (description.includes('קיוסק קקל')) {
    return {
      business: 'd5d02140-9e09-4a49-82d0-3be6983794bf', //name: 'לה קפה',
      description: 'Coffeee',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('ספסל בן גוריון')) {
    return {
      business: '3cf7f0de-3f50-4571-b917-a9dd8a181213', //name: 'ספסל בן גוריון',
      description: 'Coffee',
      tags: [{ name: 'food' }],
    };
  }
  if (description.includes('גולדשטיין בן_עמי')) {
    return {
      business: '64914e5c-533f-4175-bad5-bc2c01a21277', //name: 'Benami Goldshtein',
      description: 'Rent for 09-2021',
      tags: [{ name: 'house' }],
    };
  }
  if (description.includes('CALENDLY')) {
    return {
      business: '3188b1eb-ae3a-4218-8f85-b05b4aed9b51', //name: 'Calendly LLC',
      description: 'Calendar service',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  if (description.includes('קיי אס פי מחשבים')) {
    return {
      business: 'a1e47b67-9693-40b0-a2d1-61c1ecbc4030', //name: 'KSP',
      description: 'Computer',
      tags: [{ name: 'computer' }],
      beneficiaaries: [], // NOTE: used to be ' '
    };
  }
  if (formatAmount(DbCharge.event_amount) == -600) {
    return {
      business: '02d467c9-0818-45e3-9a25-9f99d0101a9e', //name: 'ZAUM',
      description: 'Matic Zavadlal - April 2021',
      tags: [{ name: 'business' }],
      beneficiaries: [
        {
          counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
          percentage: 0.5,
        },
        {
          counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
          percentage: 0.5,
        },
      ],
    };
  }
  //   if (charge.transactions[0]?.__typename === 'ConversionTransaction') {
  //     return {
  //       business: {
  //         '8fa16264-de32-4592-bffb-64a1914318ad'//name: 'Poalim',
  //       description: 'Conversion for ',
  //       tags: [{ name: 'conversion' }],
  //     };
  //   }
  return null;
};

export const chargeSuggestionsResolvers: ChargesModule.Resolvers = {
  Charge: {
    missingInfoSuggestions: missingInfoSuggestions as ChargeResolvers['missingInfoSuggestions'],
  },
};
