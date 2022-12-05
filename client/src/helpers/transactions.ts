import type { TransactionType } from '../models/types';
import {
  businessesNotToShare,
  businessesWithoutTaxCategory,
  entitiesWithoutInvoice,
  privateBusinessExpenses,
} from './groups.js';

interface FinancialEntity {
  financialEntity: string;
  userDescription?: string;
  financialAccountsToBalance?: string;
  personalCategory: string;
  vat?: string;
  taxCategory?: string;
}

export function suggestedTransaction(transaction: TransactionType): FinancialEntity {
  if (transaction.detailed_bank_description == 'SLACK TAYJ1FSUA/DUBLIN') {
    return {
      financialEntity: 'Slack',
      userDescription: 'Slack',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('CLOUDFLARE')) {
    return {
      financialEntity: 'Cloudflare',
      userDescription: 'Domain Registration',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('WOLT')) {
    return { financialEntity: 'Wolt', userDescription: 'Wolt', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('שטראוס מים')) {
    return { financialEntity: 'Tami4', userDescription: 'Water', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('חומוס פול התימני')) {
    return {
      financialEntity: 'חומוס פול התימני',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
  if (
    transaction.detailed_bank_description.includes('אי אם פי אם') ||
    transaction.detailed_bank_description.includes('איי.אם.פי.אם')
  ) {
    return { financialEntity: 'AmPm', userDescription: 'Groceries', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('סופר יודה')) {
    return { financialEntity: 'סופר יודה', userDescription: 'Groceries', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('הצרכניה-צמרת')) {
    return {
      financialEntity: 'הצרכניה-צמרת',
      userDescription: 'Groceries',
      personalCategory: 'food',
    };
  }
  if (transaction.detailed_bank_description.includes('מטח-קניה')) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  }
  if (transaction.detailed_bank_description.includes(`רכישת מט"ח`)) {
    return { financialEntity: 'Poalim', personalCategory: 'conversion' };
  }
  if (transaction.detailed_bank_description.includes('חשבונית ירוקה')) {
    return {
      financialEntity: 'Green Invoice',
      userDescription: 'Green Invoice Monthly Charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (
    transaction.detailed_bank_description == `ע' העברת מט"ח` ||
    (transaction.detailed_bank_description.includes(`העברת מט"ח`) &&
      Math.abs(Number(transaction.event_amount)) < 400) ||
    (transaction.detailed_bank_description.includes('מטח') &&
      Math.abs(Number(transaction.event_amount)) < 400) ||
    transaction.detailed_bank_description.includes('F.C.COM') ||
    transaction.detailed_bank_description.includes('ע.מפעולות-ישיר') ||
    transaction.detailed_bank_description.includes('ריבית חובה') ||
    transaction.detailed_bank_description.includes('FEE')
  ) {
    return {
      financialEntity: 'Poalim',
      personalCategory: 'financial',
      userDescription: `Fees for bank_reference=${transaction.bank_reference}`,
    };
  }
  if (transaction.detailed_bank_description.includes('ריבית זכות')) {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Interest fees on Euro plus',
      personalCategory: 'financial',
    };
  }
  if (transaction.detailed_bank_description.includes('דותן שמחה')) {
    return {
      financialEntity: 'Dotan Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'dotan',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('גולדשטין אורי')) {
    return {
      financialEntity: 'Uri Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'uri',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('גרדוש')) {
    return {
      financialEntity: 'Gil Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('גלעד תדהר')) {
    return {
      financialEntity: 'Gilad Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('תובל שמחה')) {
    return {
      financialEntity: 'Tuval Employee',
      userDescription: '02/2022 Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('מנורה מבטחים פנס')) {
    return {
      financialEntity: 'מנורה פנסיה',
      userDescription: 'Pension 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('פניקס אקסלנס')) {
    return {
      financialEntity: 'פניקס השתלמות',
      userDescription: 'Training Fund 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('מיטב דש גמל ופנס')) {
    return {
      financialEntity: 'איילון פנסיה',
      userDescription: 'Pension 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('מגדל מקפת')) {
    return {
      financialEntity: 'מגדל פנסיה',
      userDescription: 'Training Fund 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('מגדל השתלמות')) {
    return {
      financialEntity: 'מגדל השתלמות',
      userDescription: 'Training Fund 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (
    transaction.detailed_bank_description == 'הוט נט שרותי אינטרנט' ||
    transaction.detailed_bank_description == 'HOT'
  ) {
    return {
      financialEntity: 'HOT',
      userDescription: `Internet Provider`,
      personalCategory: 'computer',
    };
  }
  if (transaction.detailed_bank_description.includes('סלקום')) {
    return {
      financialEntity: 'Celcom',
      userDescription: `Internet Provider`,
      personalCategory: 'computer',
    };
  }
  if (
    transaction.detailed_bank_description.includes('יורוקארד') ||
    transaction.detailed_bank_description.includes('ISRACARD')
  ) {
    return {
      financialEntity: 'Isracard',
      userDescription: 'Creditcard charge',
      personalCategory: 'creditcard',
    };
  }
  if (transaction.detailed_bank_description.includes('MEETUP')) {
    return {
      financialEntity: 'Meetup',
      userDescription: 'Meetup Monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('ביטוח לאומי')) {
    return {
      financialEntity: 'Social Security Deductions',
      userDescription: 'Salaries of Uri Dotan and Gil March 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description == 'HOT MOBILE') {
    return {
      financialEntity: 'Hot Mobile',
      userDescription: 'Hot Mobile Monthly charge',
      taxCategory: 'פלאפון',
      financialAccountsToBalance: ' ',
      personalCategory: 'communications',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('GITHUB')) {
    const suggestedTransaction = {
      financialEntity: 'GitHub',
      userDescription: 'GitHub Actions',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
    if (Number(transaction.event_amount) <= -450) {
      suggestedTransaction.userDescription = 'Monthly Sponsor for Yaacov and Benjie';
    } else if (Number(transaction.event_amount) == -4) {
      suggestedTransaction.userDescription = 'GitHub CI charges';
    }
    return suggestedTransaction;
  }
  if (transaction.detailed_bank_description.includes('גילדה למוצרי תוכנה')) {
    return {
      financialEntity: 'Software Products Guilda Ltd.',
      userDescription: 'The Guild work',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('אורי גולדשטיין בע')) {
    return {
      financialEntity: 'Uri Goldshgtein LTD',
      userDescription: 'Transaction to company',
      personalCategory: 'business',
    };
  }
  if (Number(transaction.event_amount) == -4329) {
    return {
      financialEntity: 'Avi Peretz',
      userDescription: 'Office rent',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('פיוז אוטוטק')) {
    return {
      financialEntity: 'פיוז אוטוטק בעמ',
      userDescription: 'The Guild Enterprise Support 02/22',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('ט.מ.ל מערכות')) {
    return {
      financialEntity: 'Tamal',
      userDescription: 'Salary software',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('רשם החברות')) {
    return {
      financialEntity: 'מ.המשפטים-רשם החברות',
      userDescription: 'Company registration yearly fee',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description == 'פועלים- דמי כרטיס') {
    return {
      financialEntity: 'Poalim',
      userDescription: 'Bank creditcard fees',
      personalCategory: 'financial',
    };
  }
  if (transaction.detailed_bank_description == 'מוניטור') {
    return {
      financialEntity: 'Monitor',
      userDescription: 'Personal Finance App',
      personalCategory: 'financial',
    };
  }
  if (transaction.detailed_bank_description.includes('G.CO')) {
    return {
      financialEntity: 'Google Fi',
      userDescription: 'Google Fi',
      financialAccountsToBalance: ' ',
      personalCategory: 'communications',
    };
  }
  if (transaction.detailed_bank_description.includes('ארומה')) {
    return { financialEntity: 'Aroma', userDescription: 'Coffee', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('פפואה')) {
    return { financialEntity: 'פפואה', userDescription: 'Coffee', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('סופר פארם')) {
    return {
      financialEntity: 'SuperPharm',
      userDescription: 'Personal care',
      personalCategory: 'health',
    };
  }
  if (transaction.detailed_bank_description == 'חברת פרטנר תקשורת בע') {
    return { financialEntity: 'Partner', personalCategory: 'family' };
  }
  if (
    transaction.detailed_bank_description.includes('העברה מחו"ל') &&
    transaction.detailed_bank_description.includes('SDI PROCUREMEN')
  ) {
    return {
      financialEntity: 'sdi procurement solutions',
      taxCategory: 'הכנפט1',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('ZOOM')) {
    return {
      financialEntity: 'Zoom',
      userDescription: 'Zoom for therapy',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      personalCategory: 'love',
    };
  }
  if (
    transaction.detailed_bank_description.includes('MOUNTAIN V') ||
    transaction.detailed_bank_description.includes('STORA')
  ) {
    return {
      financialEntity: 'Google Storage',
      userDescription: 'Google Storage',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      personalCategory: 'computer',
    };
  }
  if (transaction.detailed_bank_description == 'APPLE COM BILL/ITUNES.COM') {
    const suggestedTransaction = {
      financialEntity: 'Apple',
      taxCategory: 'אתר',
      financialAccountsToBalance: ' ',
      vat: '0',
      userDescription: 'Apple Services',
      personalCategory: 'computer',
    };
    if (Number(transaction.event_amount) == -109.9) {
      suggestedTransaction.userDescription = 'LinkedIn';
      suggestedTransaction.personalCategory = 'business';
    }
    return suggestedTransaction;
  }
  if (transaction.detailed_bank_description == 'GETT') {
    return {
      financialEntity: 'Gett',
      userDescription: 'Taxi',
      financialAccountsToBalance: ' ',
      personalCategory: 'transportation',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('סונול')) {
    return { financialEntity: 'Sonol', userDescription: 'Gas', personalCategory: 'transportation' };
  }
  if (transaction.detailed_bank_description.includes('CARPOOL')) {
    return {
      financialEntity: 'Google Waze',
      userDescription: 'Waze Carpool',
      personalCategory: 'transportation',
    };
  }
  if (transaction.detailed_bank_description.includes('קאר 2 גו')) {
    return {
      financialEntity: 'קאר 2 גו',
      userDescription: 'Car rental',
      personalCategory: 'transportation',
    };
  }
  if (transaction.detailed_bank_description.includes('UBER')) {
    return { financialEntity: 'Uber', userDescription: 'Taxi', personalCategory: 'transportation' };
  }
  if (transaction.detailed_bank_description.includes('ZAPIER')) {
    return {
      financialEntity: 'Zapier Inc.',
      userDescription: 'Zapier monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('NOTION')) {
    return {
      financialEntity: 'Notion Labs, Inc',
      userDescription: 'Notion monthly charge',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('ALTINITY')) {
    return {
      financialEntity: 'Altinity Inc',
      userDescription: 'ALTINITY DB Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('PULUMI')) {
    return {
      financialEntity: 'Pulumi Comporation',
      userDescription: 'Infrastructure Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('קרן מכבי- חיוב')) {
    return {
      financialEntity: 'Maccabi',
      userDescription: 'Monthly health bill',
      personalCategory: 'health',
    };
  }
  if (transaction.detailed_bank_description.includes('MSFT AZURE')) {
    return {
      financialEntity: 'Microsoft Azure',
      userDescription: 'Infrastructure',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('AWS EMEA')) {
    return {
      financialEntity: 'Amazon Web Services EMEA SARL',
      userDescription: 'Infrastructure',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('LOOM')) {
    return {
      financialEntity: 'Loom',
      userDescription: 'Video recording for business',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes("ג'אסט לאנס")) {
    return {
      financialEntity: 'JustLance LTD',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('LANCE GLOBAL')) {
    return {
      financialEntity: 'Lance Global Inc',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('CRISP')) {
    return {
      financialEntity: 'Crisp IM SARL',
      userDescription: 'Monthly Crisp',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('VERCEL')) {
    return {
      financialEntity: 'Vercel Inc.',
      userDescription: 'Vercel Hosting',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('RETOOL')) {
    return {
      financialEntity: 'Retool Inc',
      userDescription: 'Retool',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('הוק האוס אוף קופי')) {
    return {
      financialEntity: 'HOC - House Of Coffee',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  }
  if (transaction.detailed_bank_description.includes('מנטנטו')) {
    return {
      financialEntity: 'Men Tenten Ramen Bar',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
  if (transaction.detailed_bank_description.includes('משק ברזילי בע"מ')) {
    return {
      financialEntity: 'Meshek Barzilay',
      userDescription: 'Food',
      personalCategory: 'food',
    };
  }
  if (transaction.detailed_bank_description.includes('טל יהלום')) {
    return { financialEntity: 'Tal Yahalom', userDescription: 'gift', personalCategory: 'family' };
  }
  if (transaction.detailed_bank_description.includes('רוני שפירא')) {
    return {
      financialEntity: 'Roney Shapira',
      userDescription: 'gift',
      personalCategory: 'family',
    };
  }
  if (
    transaction.detailed_bank_description.includes('הלמן-אלדובי') &&
    transaction.detailed_bank_description.includes('השתלמות')
  ) {
    return {
      financialEntity: 'Halman Aldubi Training Fund',
      financialAccountsToBalance: 'training_fund',
      personalCategory: 'investments',
    };
  }
  if (
    transaction.detailed_bank_description.includes('הלמן-אלדובי') &&
    transaction.detailed_bank_description.includes('קרן')
  ) {
    return {
      financialEntity: 'Halman Aldubi Pension',
      financialAccountsToBalance: 'pension',
      personalCategory: 'investments',
    };
  }
  if (transaction.detailed_bank_description.includes('PAYPER')) {
    return {
      financialEntity: 'Payper',
      userDescription: 'Invoice Management Software',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (
    transaction.detailed_bank_description.includes('העברת מט"ח') &&
    (transaction.detailed_bank_description.includes('fbv') ||
      transaction.detailed_bank_description.includes('fv'))
  ) {
    return {
      financialEntity: 'Jelly JS Kamil Kisiela',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('Vignesh')) {
    return {
      financialEntity: 'Vignesh T.V.',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('sof0')) {
    return {
      financialEntity: 'LaunchMade Web Services',
      userDescription: 'Jamie Barton',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
    };
  }
  if (transaction.detailed_bank_description.includes('Steinbock Software LTD')) {
    return {
      financialEntity: 'Steinbock Software LTD',
      financialAccountsToBalance: 'no',
      personalCategory: 'business',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('מס הכנסה')) {
    const suggestedTransaction = {
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      financialEntity: 'Tax',
      userDescription: 'Advance Tax for April 2021',
    };
    if (transaction.detailed_bank_description.includes('מס הכנסה ני')) {
      suggestedTransaction.financialEntity = 'Tax Deductions';
      suggestedTransaction.userDescription = 'Tax for employees for March-April 2021';
    }
    return suggestedTransaction;
  }
  if (transaction.detailed_bank_description.includes('גורניצקי')) {
    return {
      financialEntity: 'Gornitzky & Co., Advocates',
      userDescription: '10-11/21 lawyer support',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (
    transaction.detailed_bank_description.includes('המכס ומעמ-גביי תשלום') ||
    transaction.detailed_bank_description.includes('CUSTOM + V.A.T')
  ) {
    return {
      financialEntity: 'VAT',
      userDescription: 'VAT for March-April 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('מטרי')) {
    return {
      financialEntity: 'Yaacov Matri',
      userDescription: 'Consulting',
      personalCategory: 'learn',
      financialAccountsToBalance: ' ',
      taxCategory: 'יעוץ',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('HEROKU')) {
    return {
      financialEntity: 'Heroku',
      userDescription: 'accounter DB',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('RAINTANK INC')) {
    return {
      financialEntity: 'Raintank Inc dba Grafana Labs',
      userDescription: 'Grafana Cloud',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('JETBRAINS')) {
    return {
      financialEntity: 'JetBrains',
      userDescription: 'DataGrip',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('RESCUETIME')) {
    return {
      financialEntity: 'RescueTime',
      userDescription: 'Time software',
      personalCategory: 'computer',
      financialAccountsToBalance: ' ',
    };
  }
  if (transaction.detailed_bank_description.includes('חניון')) {
    const suggestedTransaction = {
      financialEntity: 'Parking',
      userDescription: 'Parking',
      personalCategory: 'transportation',
    };
    if (transaction.detailed_bank_description.includes('אחוזות החוף')) {
      suggestedTransaction.financialEntity = 'Ahuzot';
    }
    return suggestedTransaction;
  }
  if (transaction.detailed_bank_description.includes('גיא אברהם')) {
    return {
      financialEntity: 'Guy Avraham',
      userDescription: 'Wix Hashavshevet project',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('חשבשבת')) {
    return {
      financialEntity: 'Hashavshevet',
      userDescription: 'Accounting app',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (
    transaction.detailed_bank_description.includes('יהל-מור') ||
    transaction.detailed_bank_description.includes('רווה רביד')
  ) {
    return {
      financialEntity: 'Raveh Ravid & Co',
      userDescription: 'Accountancy with Narkis',
      personalCategory: 'business',
      taxCategory: 'הנחש',
      financialAccountsToBalance: 'no',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('GODADDY')) {
    return {
      financialEntity: 'GoDaddy',
      userDescription: 'Domain',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: '0',
    };
  }
  if (transaction.detailed_bank_description.includes('DALET DIGITAL')) {
    return {
      financialEntity: 'Dalet Digital Media Systems USA Inc',
      userDescription: 'Advance Payment - March',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('OUTREACH')) {
    return {
      financialEntity: 'Outreach Corporation',
      userDescription: 'Apollo GraphQL server (aka Giraffe) improvements in Outreach - 1st month',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('ard')) {
    return {
      financialEntity: 'Arda Tanrikulu',
      userDescription: 'Payment for February 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('deel')) {
    return {
      financialEntity: 'Deel Germany GmbH',
      userDescription: 'Laurin Salary',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('עידן')) {
    return {
      financialEntity: 'Idan Am-Shalem',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('מועדון הבלוק')) {
    return { financialEntity: 'The Block', userDescription: 'Party', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('EVENTBUZZ TICKETS')) {
    return {
      financialEntity: 'EVENTBUZZ TICKETS',
      userDescription: 'Party',
      personalCategory: 'fun',
    };
  }
  if (transaction.detailed_bank_description.includes('סלון ברלין')) {
    return { financialEntity: 'סלון ברלין', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('סילון')) {
    return { financialEntity: 'סילון', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('גוגיס')) {
    return { financialEntity: 'גוגיס', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('אלברט 1943')) {
    return { financialEntity: 'אלברט 1943', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('223')) {
    return { financialEntity: '223 Bar', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('רמפה')) {
    return { financialEntity: 'Ala Rampa', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('K-BAR')) {
    return { financialEntity: 'K BAR', userDescription: 'Bar', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('NETFLIX')) {
    return { financialEntity: 'Netflix', userDescription: 'TV', personalCategory: 'fun' };
  }
  if (transaction.detailed_bank_description.includes('תורגמן יצחק ואברהם')) {
    return {
      financialEntity: 'תורגמן יצחק ואברהם',
      userDescription: 'טמבוריה',
      personalCategory: 'house',
    };
  }
  if (transaction.detailed_bank_description.includes('אריה קריסטל')) {
    return {
      financialEntity: 'Arye Kristal',
      userDescription: 'Water bill for 04-2022',
      personalCategory: 'house',
    };
  }
  if (transaction.detailed_bank_description.includes('קאופמן מנעולים')) {
    return {
      financialEntity: 'קאופמן מנעולים',
      userDescription: 'טמבוריה',
      personalCategory: 'house',
    };
  }
  if (transaction.detailed_bank_description.includes("חב' חשמל דן חשבונות")) {
    return {
      financialEntity: 'חב חשמל דן חשבונות',
      userDescription: 'Electricity bill',
      personalCategory: 'house',
    };
  }
  if (transaction.detailed_bank_description.includes('EUFYLIFE')) {
    return { financialEntity: 'Eufy', userDescription: 'Home Camera', personalCategory: 'house' };
  }
  if (transaction.detailed_bank_description.includes('NAME COM')) {
    return {
      financialEntity: 'NAME COM',
      userDescription: 'Domain',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('SENTRY')) {
    return {
      financialEntity: 'Sentry',
      userDescription: 'Monitoring',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('RENDER')) {
    return {
      financialEntity: 'Render',
      userDescription: 'Hosting',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('ELASTIC')) {
    return {
      financialEntity: 'Elasticsearch AS',
      userDescription: 'Hive storage',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (
    transaction.detailed_bank_description.includes('GSUITE') ||
    transaction.detailed_bank_description.includes('GOOGLE CLOUD')
  ) {
    return {
      financialEntity: 'Google Ireland Limited',
      userDescription: 'G Suite for The Guild',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('רב-פס')) {
    return {
      financialEntity: 'רב-פס',
      userDescription: 'Bus tickets',
      personalCategory: 'transportation',
      financialAccountsToBalance: ' ',
      taxCategory: 'נסע',
      vat: ((Number(transaction.event_amount) / 117) * 17).toFixed(2),
    };
  }
  if (transaction.detailed_bank_description.includes('קיוסק קקל')) {
    return { financialEntity: 'לה קפה', userDescription: 'Coffeee', personalCategory: 'food' };
  }
  if (transaction.detailed_bank_description.includes('ספסל בן גוריון')) {
    return {
      financialEntity: 'ספסל בן גוריון',
      userDescription: 'Coffee',
      personalCategory: 'food',
    };
  }
  if (transaction.detailed_bank_description.includes('גולדשטיין בן_עמי')) {
    return {
      financialEntity: 'Benami Goldshtein',
      userDescription: 'Rent for 09-2021',
      personalCategory: 'house',
    };
  }
  if (transaction.detailed_bank_description.includes('CALENDLY')) {
    return {
      financialEntity: 'Calendly LLC',
      userDescription: 'Calendar service',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  if (transaction.detailed_bank_description.includes('קיי אס פי מחשבים')) {
    return {
      financialEntity: 'KSP',
      userDescription: 'Computer',
      personalCategory: 'computer',
      financialAccountsToBalance: ' ',
    };
  }
  if (Number(transaction.event_amount) == -600) {
    return {
      financialEntity: 'Zaum',
      userDescription: 'Matic Zavadlal - April 2021',
      personalCategory: 'business',
      financialAccountsToBalance: 'no',
    };
  }
  const suggestedTransaction = {
    financialEntity: transaction.detailed_bank_description.replaceAll(`"`, '').replaceAll(`'`, ''),
    userDescription: 'Food',
    personalCategory: 'food',
  };

  if (transaction.is_conversion) {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.userDescription = 'Conversion for ';
    suggestedTransaction.personalCategory = 'conversion';
  }
  return suggestedTransaction;
}

export const isBusiness = (transaction: TransactionType) => {
  return (
    (transaction.account_number == 61_066 ||
      transaction.account_number == 2733 ||
      transaction.account_number == 466_803 ||
      transaction.account_number == 1082 ||
      transaction.account_number == 5972 ||
      transaction.account_number == 1074) &&
    !entitiesWithoutInvoice.includes(transaction.financial_entity ?? '')
  );
};

export const shareWithDotan = (transaction: TransactionType) => {
  if (
    !transaction.financial_accounts_to_balance ||
    ['no', ' ', 'yes', 'pension', 'training_fund'].includes(
      transaction.financial_accounts_to_balance,
    )
  ) {
    return false;
  }

  const financialEntity = transaction.financial_entity ?? '';

  return !(
    !isBusiness(transaction) ||
    privateBusinessExpenses.includes(financialEntity) ||
    businessesNotToShare.includes(financialEntity) ||
    businessesWithoutTaxCategory.includes(financialEntity)
  );
};
