import { FinancialAmount, SuggestedChargeFragment } from '../__generated__/types';
import { formatFinancialAmount } from './vat';

export interface SuggestedCharge {
  financialEntity: string;
  userDescription?: string;
  financialAccountsToBalance?: 'no' | ' ' | 'dotan' | 'uri' | 'training_fund' | 'pension';
  personalCategory: string;
  vat?: FinancialAmount;
  taxCategory?: string;
}

// TODO: move logic to server?
export function suggestedCharge(charge: SuggestedChargeFragment['charges'][0]): SuggestedCharge {
  const transactionDescription = charge.transactions?.[0]?.description;
  if (transactionDescription?.includes('SLACK TAYJ1FSUA/DUBLIN')) {
    return {
      financialEntity: 'Slack',
      userDescription: 'Slack',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('CLOUDFLARE')) {
    return {
      financialEntity: 'Cloudflare',
      userDescription: 'Domain Registration',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('WOLT')) {
    return {
      financialEntity: 'Wolt',
      userDescription: 'Wolt',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('שטראוס מים')) {
    return {
      financialEntity: 'Tami4',
      userDescription: 'Water',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('חומוס פול התימני')) {
    return {
      financialEntity: 'חומוס פול התימני',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('אי אם פי אם') || transactionDescription?.includes('איי.אם.פי.אם')) {
    return {
      financialEntity: 'AmPm',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('סופר יודה')) {
    return {
      financialEntity: 'סופר יודה',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('הצרכניה-צמרת')) {
    return {
      financialEntity: 'הצרכניה-צמרת',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('מטח-קניה')) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  }
  if (transactionDescription?.includes(`רכישת מט"ח`)) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  }
  if (transactionDescription?.includes(`מטח-מכירה`)) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  }
  if (transactionDescription?.includes(`המרת מט"ח`)) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  }
  if (transactionDescription?.includes('חשבונית ירוקה')) {
    return {
      financialEntity: 'Green Invoice',
      userDescription: 'Green Invoice Monthly Charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (
    transactionDescription?.includes(`ע' העברת מט"ח`) ||
    (transactionDescription?.includes(`העברת מט"ח`) && Math.abs(charge.transactions[0]?.amount.raw) < 400) ||
    (transactionDescription?.includes('מטח') && Math.abs(charge.transactions[0]?.amount.raw) < 400) ||
    transactionDescription?.includes('F.C.COM') ||
    transactionDescription?.includes('ע.מפעולות-ישיר') ||
    transactionDescription?.includes('ריבית חובה') ||
    transactionDescription?.includes('FEE')
  ) {
    return {
      financialEntity: 'Poalim',
      personalCategory: 'financial',
      userDescription: `Fees for bank_reference=${charge.transactions[0]?.referenceNumber}`,
    };
  }
  if (transactionDescription?.includes('ריבית זכות')) {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Interest fees on Euro plus',
      personalCategory: 'financial',
    };
  }
  if (transactionDescription?.includes('י.י. יעוץ והשקעות')) {
    return {
      financialEntity: 'Yossi Yaron',
      userDescription: `Tax benefits consultation`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('דותן שמחה') || transactionDescription?.includes('שמחה דותן')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Dotan Employee',
      userDescription: `${previousMonth}/2022 Salary`,
      personalCategory: 'business',
      financialAccountsToBalance: 'dotan',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('גולדשטין אורי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Uri Employee',
      userDescription: `${previousMonth}/2022 Salary`,
      personalCategory: 'business',
      financialAccountsToBalance: 'uri',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('גרדוש')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Gil Employee',
      userDescription: `${previousMonth}/2022 Salary`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('גלעד תדהר')) {
    return {
      financialEntity: 'Gilad Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('תובל')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Tuval Employee',
      userDescription: `${previousMonth}/2022 Salary`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('מנורה מבטחים פנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'מנורה פנסיה',
      userDescription: `Pension ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('פניקס אקסלנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'פניקס השתלמות',
      userDescription: `Training Fund ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('מיטב דש גמל ופנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'איילון פנסיה',
      userDescription: `Pension ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('מגדל מקפת')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'מגדל פנסיה',
      userDescription: `Training Fund ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('מגדל השתלמות')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'מגדל השתלמות',
      userDescription: `Training Fund ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('הוט נט שרותי אינטרנט') || transactionDescription?.includes('HOT')) {
    return {
      financialEntity: 'HOT',
      userDescription: `Internet Provider`,
      personalCategory: 'computer',
    };
  }
  if (transactionDescription?.includes('סלקום')) {
    return {
      financialEntity: 'Celcom',
      userDescription: `Internet Provider`,
      personalCategory: 'computer',
    };
  }
  if (transactionDescription?.includes('יורוקארד') || transactionDescription?.includes('ISRACARD')) {
    return {
      financialEntity: 'Isracard',
      userDescription: 'Creditcard charge',
      personalCategory: 'creditcard',
    };
  }
  if (transactionDescription?.includes('MEETUP')) {
    return {
      financialEntity: 'Meetup',
      userDescription: 'Meetup Monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('ביטוח לאומי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Social Security Deductions',
      userDescription: `Social Security Deductions for Salaries ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('HOT MOBILE')) {
    return {
      financialEntity: 'Hot Mobile',
      userDescription: 'Hot Mobile Monthly charge',
      taxCategory: 'פלאפון',
      financialAccountsToBalance: ' ',
      personalCategory: 'communications',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('GITHUB')) {
    const suggested = {
      financialEntity: 'GitHub',
      userDescription: 'GitHub Actions',
      financialAccountsToBalance: 'no' as const,
      personalCategory: 'business',
    };
    if (charge.transactions[0]?.amount.raw <= -450) {
      suggested.userDescription = 'Monthly Sponsor for Yaacov and Benjie';
    } else if (charge.transactions[0]?.amount.raw == -4) {
      suggested.userDescription = 'GitHub CI charges';
    }
    return suggested;
  }
  if (transactionDescription?.includes('גילדה למוצרי תוכנה')) {
    return {
      financialEntity: 'Software Products Guilda Ltd.',
      userDescription: 'The Guild work',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('אורי גולדשטיין בע')) {
    return {
      financialEntity: 'Uri Goldshgtein LTD',
      userDescription: 'Transaction to company',
      personalCategory: 'business',
    };
  }
  if (charge.transactions[0]?.amount.raw == -4329) {
    return {
      financialEntity: 'Avi Peretz',
      userDescription: 'Office rent',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('פיוז אוטוטק')) {
    return {
      financialEntity: 'פיוז אוטוטק בעמ',
      userDescription: 'The Guild Enterprise Support 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('ט.מ.ל מערכות')) {
    return {
      financialEntity: 'Tamal',
      userDescription: 'Salary software',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('רשם החברות')) {
    return {
      financialEntity: 'מ.המשפטים-רשם החברות',
      userDescription: 'Company registration yearly fee',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('פועלים- דמי כרטיס')) {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Bank creditcard fees',
      personalCategory: 'financial',
    };
  }
  if (transactionDescription?.includes('מוניטור')) {
    return {
      financialEntity: 'Monitor',
      userDescription: 'Personal Finance App',
      personalCategory: 'financial',
    };
  }
  if (transactionDescription?.includes('G.CO')) {
    return {
      financialEntity: 'Google Fi',
      userDescription: 'Google Fi',
      financialAccountsToBalance: ' ',
      personalCategory: 'communications',
    };
  }
  if (transactionDescription?.includes('ארומה')) {
    return {
      financialEntity: 'Aroma',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('פפואה')) {
    return {
      financialEntity: 'פפואה',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('סופר פארם')) {
    return {
      financialEntity: 'SuperPharm',
      userDescription: 'Personal care',
      personalCategory: 'health',
    };
  }
  if (transactionDescription?.includes('חברת פרטנר תקשורת בע')) {
    return { financialEntity: 'Partner', personalCategory: 'family' };
  }
  if (transactionDescription?.includes('העברה מחו"ל') && transactionDescription?.includes('SDI PROCUREMEN')) {
    return {
      financialEntity: 'sdi procurement solutions',
      taxCategory: 'הכנפט1',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('ZOOM')) {
    return {
      financialEntity: 'Zoom',
      userDescription: 'Zoom for therapy',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      personalCategory: 'love',
    };
  }
  if (transactionDescription?.includes('MOUNTAIN V') || transactionDescription?.includes('STORA')) {
    return {
      financialEntity: 'Google Storage',
      userDescription: 'Google Storage',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      personalCategory: 'computer',
    };
  }
  if (transactionDescription?.includes('APPLE COM BILL/ITUNES.COM')) {
    const flag = charge.transactions[0]?.amount.raw == -109.9;
    return {
      financialEntity: 'Apple',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      vat: formatFinancialAmount(0),
      userDescription: flag ? 'LinkedIn' : 'Apple Services',
      personalCategory: flag ? 'business' : 'computer',
    };
  }
  if (transactionDescription?.includes('GETT')) {
    return {
      financialEntity: 'Gett',
      userDescription: 'Taxi',
      financialAccountsToBalance: ' ',
      personalCategory: 'transportation',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('סונול')) {
    return {
      financialEntity: 'Sonol',
      userDescription: 'Gas',
      personalCategory: 'transportation',
    };
  }
  if (transactionDescription?.includes('קאר 2 גו')) {
    return {
      financialEntity: 'קאר 2 גו',
      userDescription: 'Car rental',
      personalCategory: 'transportation',
    };
  }
  if (transactionDescription?.includes('CARPOOL')) {
    return {
      financialEntity: 'Google Waze',
      userDescription: 'Waze Carpool',
      personalCategory: 'transportation',
    };
  }
  if (transactionDescription?.includes('UBER')) {
    return {
      financialEntity: 'Uber',
      userDescription: 'Taxi',
      personalCategory: 'transportation',
    };
  }
  if (transactionDescription?.includes('ZAPIER')) {
    return {
      financialEntity: 'Zapier Inc.',
      userDescription: 'Zapier monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('NOTION')) {
    return {
      financialEntity: 'Notion Labs, Inc',
      userDescription: 'Notion monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('ALTINITY')) {
    return {
      financialEntity: 'Altinity Inc',
      userDescription: 'ALTINITY DB Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('PULUMI')) {
    return {
      financialEntity: 'Pulumi Comporation',
      userDescription: 'Infrastructure Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('קרן מכבי- חיוב')) {
    return {
      financialEntity: 'Maccabi',
      userDescription: 'Monthly health bill',
      personalCategory: 'health',
    };
  }
  if (transactionDescription?.includes('MSFT AZURE')) {
    return {
      financialEntity: 'Microsoft Azure',
      userDescription: 'Infrastructure',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('AWS EMEA')) {
    return {
      financialEntity: 'Amazon Web Services EMEA SARL',
      userDescription: 'Infrastructure',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('LOOM')) {
    return {
      financialEntity: 'Loom',
      userDescription: 'Video recording for business',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes("ג'אסט לאנס")) {
    return {
      financialEntity: 'JustLance LTD',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('LANCE GLOBAL')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      financialEntity: 'Lance Global Inc',
      userDescription: `The Guild Enterprise Support - ${previousMonth} 2022`,
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('CRISP')) {
    return {
      financialEntity: 'Crisp IM SARL',
      userDescription: 'Monthly Crisp',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('VERCEL')) {
    return {
      financialEntity: 'Vercel Inc.',
      userDescription: 'Vercel Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('RETOOL')) {
    return {
      financialEntity: 'Retool Inc',
      userDescription: 'Retool',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('הוק האוס אוף קופי')) {
    return {
      financialEntity: 'HOC - House Of Coffee',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('מנטנטו')) {
    return {
      financialEntity: 'Men Tenten Ramen Bar',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('משק ברזילי בע"מ')) {
    return {
      financialEntity: 'Meshek Barzilay',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('טל יהלום')) {
    return {
      financialEntity: 'Tal Yahalom',
      userDescription: 'gift',
      personalCategory: 'family',
    };
  }
  if (transactionDescription?.includes('רוני שפירא')) {
    return {
      financialEntity: 'Roney Shapira',
      userDescription: 'gift',
      personalCategory: 'family',
    };
  }
  if (transactionDescription?.includes('הלמן-אלדובי') && transactionDescription?.includes('השתלמות')) {
    return {
      financialEntity: 'Halman Aldubi Training Fund',
      financialAccountsToBalance: 'training_fund',
      personalCategory: 'investments',
    };
  }
  if (transactionDescription?.includes('הלמן-אלדובי') && transactionDescription?.includes('קרן')) {
    return {
      financialEntity: 'Halman Aldubi Pension',
      financialAccountsToBalance: 'pension',
      personalCategory: 'investments',
    };
  }
  if (transactionDescription?.includes('PAYPER')) {
    return {
      financialEntity: 'Payper',
      userDescription: 'Invoice Management Software',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (
    transactionDescription?.includes('העברת מט"ח') &&
    (transactionDescription?.includes('fbv') || transactionDescription?.includes('fv'))
  ) {
    return {
      financialEntity: 'Kamil Kisiela',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (charge.transactions[0]?.amount.raw == -12000) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Saihajpreet Singh',
      financialAccountsToBalance: 'no',
      userDescription: `${previousMonth}/2022`,
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('Vignesh')) {
    return {
      financialEntity: 'Vignesh T.V.',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('sof0')) {
    return {
      financialEntity: 'LaunchMade Web Services',
      userDescription: 'Jamie Barton',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transactionDescription?.includes('Steinbock Software LTD')) {
    return {
      financialEntity: 'Steinbock Software LTD',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('מס הכנסה')) {
    const flag = transactionDescription?.includes('מס הכנסה ני');
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      financialEntity: flag ? 'Tax Deductions' : 'Tax',
      userDescription: flag ? `Tax for employees for ${previousMonth}/2022` : `Advance Tax for ${previousMonth}/2022`,
    };
  }
  if (transactionDescription?.includes('גורניצקי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Gornitzky & Co., Advocates',
      userDescription: `${previousMonth}/2022 lawyer support`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('המכס ומעמ-גביי תשלום') || transactionDescription?.includes('CUSTOM + V.A.T')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'VAT',
      userDescription: `VAT for ${previousMonth}/2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('מטרי')) {
    return {
      financialEntity: 'Yaacov Matri',
      userDescription: 'Consulting',
      personalCategory: 'learn',
      financialAccountsToBalance: ' ',
      taxCategory: 'יעוץ',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('HEROKU')) {
    return {
      financialEntity: 'Heroku',
      userDescription: 'accounter DB',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('RAINTANK INC')) {
    return {
      financialEntity: 'Raintank Inc dba Grafana Labs',
      userDescription: 'Grafana Cloud',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('JETBRAINS')) {
    return {
      financialEntity: 'JetBrains',
      userDescription: 'DataGrip',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('RESCUETIME')) {
    return {
      financialEntity: 'RescueTime',
      userDescription: 'Time software',
      personalCategory: 'computer',
      financialAccountsToBalance: ' ',
    };
  }
  if (transactionDescription?.includes('חניון')) {
    return {
      financialEntity: transactionDescription?.includes('אחוזות החוף') ? 'Ahuzot' : 'Parking',
      userDescription: 'Parking',
      personalCategory: 'transportation',
    };
  }
  if (transactionDescription?.includes('גיא אברהם')) {
    return {
      financialEntity: 'Guy Avraham',
      userDescription: 'Wix Hashavshevet project',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('חשבשבת')) {
    return {
      financialEntity: 'Hashavshevet',
      userDescription: 'Accounting app',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('יהל-מור') || transactionDescription?.includes('רווה רביד')) {
    return {
      financialEntity: 'Raveh Ravid & Co',
      userDescription: 'Accountancy with Narkis',
      personalCategory: 'business',
      taxCategory: 'הנחש',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('GODADDY')) {
    return {
      financialEntity: 'GoDaddy',
      userDescription: 'Domain',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount(0),
    };
  }
  if (transactionDescription?.includes('DALET DIGITAL')) {
    return {
      financialEntity: 'Dalet Digital Media Systems USA Inc',
      userDescription: 'Advance Payment - March',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('ETANA')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      financialEntity: 'The Graph Foundation',
      userDescription: `The Guild Enterprise Support - ${previousMonth} 2022`,
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('OUTREACH')) {
    return {
      financialEntity: 'Outreach Corporation',
      userDescription: 'Apollo GraphQL server (aka Giraffe) improvements in Outreach - 1st month',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('ard')) {
    return {
      financialEntity: 'Arda Tanrikulu',
      userDescription: 'Payment for February 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('deel')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    // const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      financialEntity: 'Deel Germany GmbH',
      userDescription: 'Laurin Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('עידן')) {
    return {
      financialEntity: 'Idan Am-Shalem',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('מועדון הבלוק')) {
    return {
      financialEntity: 'The Block',
      userDescription: 'Party',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('EVENTBUZZ TICKETS')) {
    return {
      financialEntity: 'EVENTBUZZ TICKETS',
      userDescription: 'Party',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('סלון ברלין')) {
    return {
      financialEntity: 'סלון ברלין',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('סילון')) {
    return {
      financialEntity: 'סילון',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('גוגיס')) {
    return {
      financialEntity: 'גוגיס',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('אלברט 1943')) {
    return {
      financialEntity: 'אלברט 1943',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('223')) {
    return {
      financialEntity: '223 Bar',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('רמפה')) {
    return {
      financialEntity: 'Ala Rampa',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('K-BAR')) {
    return {
      financialEntity: 'K BAR',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('NETFLIX')) {
    return {
      financialEntity: 'Netflix',
      userDescription: 'TV',
      personalCategory: 'fun',
    };
  }
  if (transactionDescription?.includes('תורגמן יצחק ואברהם')) {
    return {
      financialEntity: 'תורגמן יצחק ואברהם',
      userDescription: 'טמבוריה',
      personalCategory: 'house',
    };
  }
  if (transactionDescription?.includes('אריה קריסטל')) {
    return {
      financialEntity: 'Arye Kristal',
      userDescription: 'Water bill for 04-2022',
      personalCategory: 'house',
    };
  }
  if (transactionDescription?.includes('קאופמן מנעולים')) {
    return {
      financialEntity: 'קאופמן מנעולים',
      userDescription: 'טמבוריה',
      personalCategory: 'house',
    };
  }
  if (transactionDescription?.includes("חב' חשמל דן חשבונות")) {
    return {
      financialEntity: 'חב חשמל דן חשבונות',
      userDescription: 'Electricity bill',
      personalCategory: 'house',
    };
  }
  if (transactionDescription?.includes('EUFYLIFE')) {
    return {
      financialEntity: 'Eufy',
      userDescription: 'Home Camera',
      personalCategory: 'house',
    };
  }
  if (transactionDescription?.includes('NAME COM')) {
    return {
      financialEntity: 'NAME COM',
      userDescription: 'Domain',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('SENTRY')) {
    return {
      financialEntity: 'Sentry',
      userDescription: 'Monitoring',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('RENDER')) {
    return {
      financialEntity: 'Render',
      userDescription: 'Hosting',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('ELASTIC')) {
    return {
      financialEntity: 'Elasticsearch AS',
      userDescription: 'Hive storage',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('GSUITE') || transactionDescription?.includes('GOOGLE CLOUD')) {
    return {
      financialEntity: 'Google Ireland Limited',
      userDescription: 'G Suite for The Guild',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('רב-פס')) {
    return {
      financialEntity: 'רב-פס',
      userDescription: 'Bus tickets',
      personalCategory: 'transportation',
      financialAccountsToBalance: ' ',
      taxCategory: 'נסע',
      vat: formatFinancialAmount((charge.transactions[0]?.amount.raw / 117) * 17),
    };
  }
  if (transactionDescription?.includes('קיוסק קקל')) {
    return {
      financialEntity: 'לה קפה',
      userDescription: 'Coffeee',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('ספסל בן גוריון')) {
    return {
      financialEntity: 'ספסל בן גוריון',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  }
  if (transactionDescription?.includes('גולדשטיין בן_עמי')) {
    return {
      financialEntity: 'Benami Goldshtein',
      userDescription: 'Rent for 09-2021',
      personalCategory: 'house',
    };
  }
  if (transactionDescription?.includes('CALENDLY')) {
    return {
      financialEntity: 'Calendly LLC',
      userDescription: 'Calendar service',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transactionDescription?.includes('קיי אס פי מחשבים')) {
    return {
      financialEntity: 'KSP',
      userDescription: 'Computer',
      personalCategory: 'computer',
      financialAccountsToBalance: ' ',
    };
  }
  if (charge.transactions[0]?.amount.raw == -600) {
    return {
      financialEntity: 'Zaum',
      userDescription: 'Matic Zavadlal - April 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (charge.transactions[0]?.__typename === 'ConversionTransaction') {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Conversion for ',
      personalCategory: 'conversion',
    };
  }
  return {
    financialEntity: transactionDescription?.replaceAll(`"`, '').replaceAll(`'`, '') ?? '',
    userDescription: 'Food',
    personalCategory: 'food',
  };
}
