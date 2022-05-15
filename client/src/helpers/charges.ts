import { SuggestedChargeFragment } from '../__generated__/types';

interface SuggestedCharge {
  financialEntity: string;
  userDescription?: string;
  financialAccountsToBalance?:
    | 'no'
    | ' '
    | 'dotan'
    | 'uri'
    | 'training_fund'
    | 'pension';
  personalCategory: string;
  vat?: number;
  taxCategory?: string;
}

// TODO: move logic to server?
export function suggestedCharge(
  charge: SuggestedChargeFragment
): SuggestedCharge | undefined {
  // let suggestedTransaction: SuggestedCharge | undefined = {};
  if (charge.description == 'SLACK TAYJ1FSUA/DUBLIN') {
    return {
      financialEntity: 'Slack',
      userDescription: 'Slack',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('CLOUDFLARE')) {
    return {
      financialEntity: 'Cloudflare',
      userDescription: 'Domain Registration',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('WOLT')) {
    return {
      financialEntity: 'Wolt',
      userDescription: 'Wolt',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('שטראוס מים')) {
    return {
      financialEntity: 'Tami4',
      userDescription: 'Water',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('חומוס פול התימני')) {
    return {
      financialEntity: 'חומוס פול התימני',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  } else if (
    charge.description?.includes('אי אם פי אם') ||
    charge.description?.includes('איי.אם.פי.אם')
  ) {
    return {
      financialEntity: 'AmPm',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('סופר יודה')) {
    return {
      financialEntity: 'סופר יודה',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('הצרכניה-צמרת')) {
    return {
      financialEntity: 'הצרכניה-צמרת',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('מטח-קניה')) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  } else if (charge.description?.includes(`רכישת מט"ח`)) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  } else if (charge.description?.includes('חשבונית ירוקה')) {
    return {
      financialEntity: 'Green Invoice',
      userDescription: 'Green Invoice Monthly Charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (
    charge.description == `ע' העברת מט"ח` ||
    (charge.description?.includes(`העברת מט"ח`) &&
      Math.abs(charge.transactions[0]?.amount.raw) < 400) ||
    (charge.description?.includes('מטח') &&
      Math.abs(charge.transactions[0]?.amount.raw) < 400) ||
    charge.description?.includes('F.C.COM') ||
    charge.description?.includes('ע.מפעולות-ישיר') ||
    charge.description?.includes('ריבית חובה') ||
    charge.description?.includes('FEE')
  ) {
    return {
      financialEntity: 'Poalim',
      personalCategory: 'financial',
      userDescription: `Fees for bank_reference=${charge.transactions[0]?.referenceNumber}`,
    };
  } else if (charge.description?.includes('ריבית זכות')) {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Interest fees on Euro plus',
      personalCategory: 'financial',
    };
  } else if (charge.description?.includes('דותן שמחה')) {
    return {
      financialEntity: 'Dotan Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'dotan',
      vat: 0,
    };
  } else if (charge.description?.includes('גולדשטין אורי')) {
    return {
      financialEntity: 'Uri Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'uri',
      vat: 0,
    };
  } else if (charge.description?.includes('גרדוש')) {
    return {
      financialEntity: 'Gil Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('גלעד תדהר')) {
    return {
      financialEntity: 'Gilad Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('תובל שמחה')) {
    return {
      financialEntity: 'Tuval Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('מנורה מבטחים פנס')) {
    return {
      financialEntity: 'מנורה פנסיה',
      userDescription: 'Pension 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('פניקס אקסלנס')) {
    return {
      financialEntity: 'פניקס השתלמות',
      userDescription: 'Training Fund 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('מיטב דש גמל ופנס')) {
    return {
      financialEntity: 'איילון פנסיה',
      userDescription: 'Pension 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('מגדל מקפת')) {
    return {
      financialEntity: 'מגדל פנסיה',
      userDescription: 'Training Fund 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('מגדל השתלמות')) {
    return {
      financialEntity: 'מגדל השתלמות',
      userDescription: 'Training Fund 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (
    charge.description == 'הוט נט שרותי אינטרנט' ||
    charge.description == 'HOT'
  ) {
    return {
      financialEntity: 'HOT',
      userDescription: `Internet Provider`,
      personalCategory: 'computer',
    };
  } else if (charge.description?.includes('סלקום')) {
    return {
      financialEntity: 'Celcom',
      userDescription: `Internet Provider`,
      personalCategory: 'computer',
    };
  } else if (
    charge.description?.includes('יורוקארד') ||
    charge.description?.includes('ISRACARD')
  ) {
    return {
      financialEntity: 'Isracard',
      userDescription: 'Creditcard charge',
      personalCategory: 'creditcard',
    };
  } else if (charge.description?.includes('MEETUP')) {
    return {
      financialEntity: 'Meetup',
      userDescription: 'Meetup Monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('ביטוח לאומי')) {
    return {
      financialEntity: 'Social Security Deductions',
      userDescription: 'Salaries of Uri Dotan and Gil March 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description == 'HOT MOBILE') {
    return {
      financialEntity: 'Hot Mobile',
      userDescription: 'Hot Mobile Monthly charge',
      taxCategory: 'פלאפון',
      financialAccountsToBalance: ' ',
      personalCategory: 'communications',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('GITHUB')) {
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
  } else if (charge.description?.includes('גילדה למוצרי תוכנה')) {
    return {
      financialEntity: 'Software Products Guilda Ltd.',
      userDescription: 'The Guild work',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('אורי גולדשטיין בע')) {
    return {
      financialEntity: 'Uri Goldshgtein LTD',
      userDescription: 'Transaction to company',
      personalCategory: 'business',
    };
  } else if (charge.transactions[0]?.amount.raw == -4329) {
    return {
      financialEntity: 'Avi Peretz',
      userDescription: 'Office rent',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('פיוז אוטוטק')) {
    return {
      financialEntity: 'פיוז אוטוטק בעמ',
      userDescription: 'The Guild Enterprise Support 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('ט.מ.ל מערכות')) {
    return {
      financialEntity: 'Tamal',
      userDescription: 'Salary software',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('רשם החברות')) {
    return {
      financialEntity: 'מ.המשפטים-רשם החברות',
      userDescription: 'Company registration yearly fee',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description == 'פועלים- דמי כרטיס') {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Bank creditcard fees',
      personalCategory: 'financial',
    };
  } else if (charge.description == 'מוניטור') {
    return {
      financialEntity: 'Monitor',
      userDescription: 'Personal Finance App',
      personalCategory: 'financial',
    };
  } else if (charge.description?.includes('G.CO')) {
    return {
      financialEntity: 'Google Fi',
      userDescription: 'Google Fi',
      financialAccountsToBalance: ' ',
      personalCategory: 'communications',
    };
  } else if (charge.description?.includes('ארומה')) {
    return {
      financialEntity: 'Aroma',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('פפואה')) {
    return {
      financialEntity: 'פפואה',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('סופר פארם')) {
    return {
      financialEntity: 'SuperPharm',
      userDescription: 'Personal care',
      personalCategory: 'health',
    };
  } else if (charge.description == 'חברת פרטנר תקשורת בע') {
    return { financialEntity: 'Partner', personalCategory: 'family' };
  } else if (
    charge.description?.includes('העברה מחו"ל') &&
    charge.description?.includes('SDI PROCUREMEN')
  ) {
    return {
      financialEntity: 'sdi procurement solutions',
      taxCategory: 'הכנפט1',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('ZOOM')) {
    return {
      financialEntity: 'Zoom',
      userDescription: 'Zoom for therapy',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      personalCategory: 'love',
    };
  } else if (
    charge.description?.includes('MOUNTAIN V') ||
    charge.description?.includes('STORA')
  ) {
    return {
      financialEntity: 'Google Storage',
      userDescription: 'Google Storage',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      personalCategory: 'computer',
    };
  } else if (charge.description == 'APPLE COM BILL/ITUNES.COM') {
    const flag = charge.transactions[0]?.amount.raw == -109.9;
    return {
      financialEntity: 'Apple',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      vat: 0,
      userDescription: flag ? 'LinkedIn' : 'Apple Services',
      personalCategory: flag ? 'business' : 'computer',
    };
  } else if (charge.description == 'GETT') {
    return {
      financialEntity: 'Gett',
      userDescription: 'Taxi',
      financialAccountsToBalance: ' ',
      personalCategory: 'transportation',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('סונול')) {
    return {
      financialEntity: 'Sonol',
      userDescription: 'Gas',
      personalCategory: 'transportation',
    };
  } else if (charge.description?.includes('CARPOOL')) {
    return {
      financialEntity: 'Google Waze',
      userDescription: 'Waze Carpool',
      personalCategory: 'transportation',
    };
  } else if (charge.description?.includes('UBER')) {
    return {
      financialEntity: 'Uber',
      userDescription: 'Taxi',
      personalCategory: 'transportation',
    };
  } else if (charge.description?.includes('ZAPIER')) {
    return {
      financialEntity: 'Zapier Inc.',
      userDescription: 'Zapier monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('NOTION')) {
    return {
      financialEntity: 'Notion Labs, Inc',
      userDescription: 'Notion monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('ALTINITY')) {
    return {
      financialEntity: 'Altinity Inc',
      userDescription: 'ALTINITY DB Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('PULUMI')) {
    return {
      financialEntity: 'Pulumi Comporation',
      userDescription: 'Infrastructure Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('קרן מכבי- חיוב')) {
    return {
      financialEntity: 'Maccabi',
      userDescription: 'Monthly health bill',
      personalCategory: 'health',
    };
  } else if (charge.description?.includes('MSFT AZURE')) {
    return {
      financialEntity: 'Microsoft Azure',
      userDescription: 'Infrastructure',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('AWS EMEA')) {
    return {
      financialEntity: 'Amazon Web Services EMEA SARL',
      userDescription: 'Infrastructure',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('LOOM')) {
    return {
      financialEntity: 'Loom',
      userDescription: 'Video recording for business',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes("ג'אסט לאנס")) {
    return {
      financialEntity: 'JustLance LTD',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('LANCE GLOBAL')) {
    return {
      financialEntity: 'Lance Global Inc',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('CRISP')) {
    return {
      financialEntity: 'Crisp IM SARL',
      userDescription: 'Monthly Crisp',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('VERCEL')) {
    return {
      financialEntity: 'Vercel Inc.',
      userDescription: 'Vercel Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('RETOOL')) {
    return {
      financialEntity: 'Retool Inc',
      userDescription: 'Retool',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('הוק האוס אוף קופי')) {
    return {
      financialEntity: 'HOC - House Of Coffee',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('מנטנטו')) {
    return {
      financialEntity: 'Men Tenten Ramen Bar',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('משק ברזילי בע"מ')) {
    return {
      financialEntity: 'Meshek Barzilay',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('טל יהלום')) {
    return {
      financialEntity: 'Tal Yahalom',
      userDescription: 'gift',
      personalCategory: 'family',
    };
  } else if (charge.description?.includes('רוני שפירא')) {
    return {
      financialEntity: 'Roney Shapira',
      userDescription: 'gift',
      personalCategory: 'family',
    };
  } else if (
    charge.description?.includes('הלמן-אלדובי') &&
    charge.description?.includes('השתלמות')
  ) {
    return {
      financialEntity: 'Halman Aldubi Training Fund',
      financialAccountsToBalance: 'training_fund',
      personalCategory: 'investments',
    };
  } else if (
    charge.description?.includes('הלמן-אלדובי') &&
    charge.description?.includes('קרן')
  ) {
    return {
      financialEntity: 'Halman Aldubi Pension',
      financialAccountsToBalance: 'pension',
      personalCategory: 'investments',
    };
  } else if (charge.description?.includes('PAYPER')) {
    return {
      financialEntity: 'Payper',
      userDescription: 'Invoice Management Software',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (
    charge.description?.includes('העברת מט"ח') &&
    (charge.description?.includes('fbv') || charge.description?.includes('fv'))
  ) {
    return {
      financialEntity: 'Kamil Kisiela',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('Vignesh')) {
    return {
      financialEntity: 'Vignesh T.V.',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('sof0')) {
    return {
      financialEntity: 'LaunchMade Web Services',
      userDescription: 'Jamie Barton',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  } else if (charge.description?.includes('Steinbock Software LTD')) {
    return {
      financialEntity: 'Steinbock Software LTD',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('מס הכנסה')) {
    const flag = charge.description?.includes('מס הכנסה ני');
    return {
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      financialEntity: flag ? 'Tax Deductions' : 'Tax',
      userDescription: flag
        ? 'Tax for employees for March-April 2021'
        : 'Advance Tax for April 2021',
    };
  } else if (charge.description?.includes('גורניצקי')) {
    return {
      financialEntity: 'Gornitzky & Co., Advocates',
      userDescription: '10-11/21 lawyer support',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (
    charge.description?.includes('המכס ומעמ-גביי תשלום') ||
    charge.description?.includes('CUSTOM + V.A.T')
  ) {
    return {
      financialEntity: 'VAT',
      userDescription: 'VAT for March-April 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('מטרי')) {
    return {
      financialEntity: 'Yaacov Matri',
      userDescription: 'Consulting',
      personalCategory: 'learn',
      financialAccountsToBalance: ' ',
      taxCategory: 'יעוץ',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('HEROKU')) {
    return {
      financialEntity: 'Heroku',
      userDescription: 'accounter DB',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('RAINTANK INC')) {
    return {
      financialEntity: 'Raintank Inc dba Grafana Labs',
      userDescription: 'Grafana Cloud',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('JETBRAINS')) {
    return {
      financialEntity: 'JetBrains',
      userDescription: 'DataGrip',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('RESCUETIME')) {
    return {
      financialEntity: 'RescueTime',
      userDescription: 'Time software',
      personalCategory: 'computer',
      financialAccountsToBalance: ' ',
    };
  } else if (charge.description?.includes('חניון')) {
    return {
      financialEntity: charge.description?.includes('אחוזות החוף')
        ? 'Ahuzot'
        : 'Parking',
      userDescription: 'Parking',
      personalCategory: 'transportation',
    };
  } else if (charge.description?.includes('גיא אברהם')) {
    return {
      financialEntity: 'Guy Avraham',
      userDescription: 'Wix Hashavshevet project',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('חשבשבת')) {
    return {
      financialEntity: 'Hashavshevet',
      userDescription: 'Accounting app',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (
    charge.description?.includes('יהל-מור') ||
    charge.description?.includes('רווה רביד')
  ) {
    return {
      financialEntity: 'Raveh Ravid & Co',
      userDescription: 'Accountancy with Narkis',
      personalCategory: 'business',
      taxCategory: 'הנחש',
      financialAccountsToBalance: 'no',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('GODADDY')) {
    return {
      financialEntity: 'GoDaddy',
      userDescription: 'Domain',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: 0,
    };
  } else if (charge.description?.includes('DALET DIGITAL')) {
    return {
      financialEntity: 'Dalet Digital Media Systems USA Inc',
      userDescription: 'Advance Payment - March',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('OUTREACH')) {
    return {
      financialEntity: 'Outreach Corporation',
      userDescription:
        'Apollo GraphQL server (aka Giraffe) improvements in Outreach - 1st month',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('ard')) {
    return {
      financialEntity: 'Arda Tanrikulu',
      userDescription: 'Payment for February 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('deel')) {
    return {
      financialEntity: 'Deel Germany GmbH',
      userDescription: 'Laurin Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('עידן')) {
    return {
      financialEntity: 'Idan Am-Shalem',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('מועדון הבלוק')) {
    return {
      financialEntity: 'The Block',
      userDescription: 'Party',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('EVENTBUZZ TICKETS')) {
    return {
      financialEntity: 'EVENTBUZZ TICKETS',
      userDescription: 'Party',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('סלון ברלין')) {
    return {
      financialEntity: 'סלון ברלין',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('סילון')) {
    return {
      financialEntity: 'סילון',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('גוגיס')) {
    return {
      financialEntity: 'גוגיס',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('אלברט 1943')) {
    return {
      financialEntity: 'אלברט 1943',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('223')) {
    return {
      financialEntity: '223 Bar',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('רמפה')) {
    return {
      financialEntity: 'Ala Rampa',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('K-BAR')) {
    return {
      financialEntity: 'K BAR',
      userDescription: 'Bar',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('NETFLIX')) {
    return {
      financialEntity: 'Netflix',
      userDescription: 'TV',
      personalCategory: 'fun',
    };
  } else if (charge.description?.includes('תורגמן יצחק ואברהם')) {
    return {
      financialEntity: 'תורגמן יצחק ואברהם',
      userDescription: 'טמבוריה',
      personalCategory: 'house',
    };
  } else if (charge.description?.includes('אריה קריסטל')) {
    return {
      financialEntity: 'Arye Kristal',
      userDescription: 'Water bill for 04-2022',
      personalCategory: 'house',
    };
  } else if (charge.description?.includes('קאופמן מנעולים')) {
    return {
      financialEntity: 'קאופמן מנעולים',
      userDescription: 'טמבוריה',
      personalCategory: 'house',
    };
  } else if (charge.description?.includes("חב' חשמל דן חשבונות")) {
    return {
      financialEntity: 'חב חשמל דן חשבונות',
      userDescription: 'Electricity bill',
      personalCategory: 'house',
    };
  } else if (charge.description?.includes('EUFYLIFE')) {
    return {
      financialEntity: 'Eufy',
      userDescription: 'Home Camera',
      personalCategory: 'house',
    };
  } else if (charge.description?.includes('NAME COM')) {
    return {
      financialEntity: 'NAME COM',
      userDescription: 'Domain',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('SENTRY')) {
    return {
      financialEntity: 'Sentry',
      userDescription: 'Monitoring',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('RENDER')) {
    return {
      financialEntity: 'Render',
      userDescription: 'Hosting',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('ELASTIC')) {
    return {
      financialEntity: 'Elasticsearch AS',
      userDescription: 'Hive storage',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (
    charge.description?.includes('GSUITE') ||
    charge.description?.includes('GOOGLE CLOUD')
  ) {
    return {
      financialEntity: 'Google Ireland Limited',
      userDescription: 'G Suite for The Guild',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('רב-פס')) {
    return {
      financialEntity: 'רב-פס',
      userDescription: 'Bus tickets',
      personalCategory: 'transportation',
      financialAccountsToBalance: ' ',
      taxCategory: 'נסע',
      vat: (charge.transactions[0]?.amount.raw / 117) * 17,
    };
  } else if (charge.description?.includes('קיוסק קקל')) {
    return {
      financialEntity: 'לה קפה',
      userDescription: 'Coffeee',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('ספסל בן גוריון')) {
    return {
      financialEntity: 'ספסל בן גוריון',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  } else if (charge.description?.includes('גולדשטיין בן_עמי')) {
    return {
      financialEntity: 'Benami Goldshtein',
      userDescription: 'Rent for 09-2021',
      personalCategory: 'house',
    };
  } else if (charge.description?.includes('CALENDLY')) {
    return {
      financialEntity: 'Calendly LLC',
      userDescription: 'Calendar service',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.description?.includes('קיי אס פי מחשבים')) {
    return {
      financialEntity: 'KSP',
      userDescription: 'Computer',
      personalCategory: 'computer',
      financialAccountsToBalance: ' ',
    };
  } else if (charge.transactions[0]?.amount.raw == -600) {
    return {
      financialEntity: 'Zaum',
      userDescription: 'Matic Zavadlal - April 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  } else if (charge.transactions[0]?.__typename === 'ConversionTransaction') {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Conversion for ',
      personalCategory: 'conversion',
    };
  } else {
    return {
      financialEntity:
        charge.description?.replaceAll(`"`, '').replaceAll(`'`, '') ?? '',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
}
