import { readFileSync } from 'fs';
import { pool } from './index';
import moment from 'moment';

const entitiesWithoutInvoice = [
  'Poalim',
  'Isracard',
  'Tax Deductions',
  'Tax',
  'VAT',
];

// TODO: Check this article for joins https://www.cybertec-postgresql.com/en/understanding-lateral-joins-in-postgresql/

const entitiesWithoutInvoiceNumuber = ['Uri Goldshtein'];

const privateBusinessExpenses = [
  'Google',
  'Uri Goldshtein',
  'Social Security Deductions',
  'Hot Mobile',
  'Apple',
  'HOT',
  'Yaacov Matri',
  'Partner',
];

const businessesNotToShare = ['Dotan Simha'];

const businessesWithoutTaxCategory = [
  'Uri Goldshtein',
  'Social Security Deductions',
  'Tax Deductions',
  'VAT',
  'Tax',
];

function suggestedTransaction(transaction: any) {
  let suggestedTransaction: any = {};
  if (transaction.detailed_bank_description == 'SLACK TAYJ1FSUA/DUBLIN') {
    suggestedTransaction.financialEntity = 'Slack';
    suggestedTransaction.userDescription = 'Slack';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('CLOUDFLARE')) {
    suggestedTransaction.financialEntity = 'Cloudflare';
    suggestedTransaction.userDescription = 'Domain Registration';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('WOLT')) {
    suggestedTransaction.financialEntity = 'Wolt';
    suggestedTransaction.userDescription = 'Wolt';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('שטראוס מים')) {
    suggestedTransaction.financialEntity = 'Tami4';
    suggestedTransaction.userDescription = 'Water';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('חומוס פול התימני')
  ) {
    suggestedTransaction.financialEntity = 'חומוס פול התימני';
    suggestedTransaction.userDescription = 'Food';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('אי אם פי אם') ||
    transaction.detailed_bank_description.includes('איי.אם.פי.אם')
  ) {
    suggestedTransaction.financialEntity = 'AmPm';
    suggestedTransaction.userDescription = 'Groceries';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('סופר יודה')) {
    suggestedTransaction.financialEntity = 'סופר יודה';
    suggestedTransaction.userDescription = 'Groceries';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('הצרכניה-צמרת')) {
    suggestedTransaction.financialEntity = 'הצרכניה-צמרת';
    suggestedTransaction.userDescription = 'Groceries';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מטח-קניה')) {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.personalCategory = 'conversion';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes(`רכישת מט"ח`)) {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.personalCategory = 'conversion';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('חשבונית ירוקה')) {
    suggestedTransaction.financialEntity = 'Green Invoice';
    suggestedTransaction.userDescription = 'Green Invoice Monthly Charge';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description == `ע' העברת מט"ח` ||
    (transaction.detailed_bank_description.includes(`העברת מט"ח`) &&
      Math.abs(transaction.event_amount) < 400) ||
    (transaction.detailed_bank_description.includes('מטח') &&
      Math.abs(transaction.event_amount) < 400) ||
    transaction.detailed_bank_description.includes('F.C.COM') ||
    transaction.detailed_bank_description.includes('ע.מפעולות-ישיר') ||
    transaction.detailed_bank_description.includes('ריבית חובה') ||
    transaction.detailed_bank_description.includes('FEE')
  ) {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.personalCategory = 'financial';
    suggestedTransaction.userDescription = `Fees for bank_reference=${transaction.bank_reference}`;
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ריבית זכות')) {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.userDescription = 'Interest fees on Euro plus';
    suggestedTransaction.personalCategory = 'financial';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('דותן שמחה')) {
    suggestedTransaction.financialEntity = 'Dotan Simha';
    suggestedTransaction.userDescription = 'August salary';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'dotan';
    suggestedTransaction.vat = 0;
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description == 'הוט נט שרותי אינטרנט' ||
    transaction.detailed_bank_description == 'HOT'
  ) {
    suggestedTransaction.financialEntity = 'HOT';
    suggestedTransaction.userDescription = `Internet Provider`;
    suggestedTransaction.personalCategory = 'computer';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('יורוקארד') ||
    transaction.detailed_bank_description.includes('ISRACARD')
  ) {
    suggestedTransaction.financialEntity = 'Isracard';
    suggestedTransaction.userDescription = 'Creditcard charge';
    suggestedTransaction.personalCategory = 'creditcard';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('MEETUP')) {
    suggestedTransaction.financialEntity = 'Meetup';
    suggestedTransaction.userDescription = 'Meetup Monthly charge';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ביטוח לאומי')) {
    suggestedTransaction.financialEntity = 'Social Security Deductions';
    suggestedTransaction.userDescription =
      'Salaries of Uri Dotan and Gil March 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description == 'HOT MOBILE') {
    suggestedTransaction.financialEntity = 'Hot Mobile';
    suggestedTransaction.userDescription = 'Hot Mobile Monthly charge';
    suggestedTransaction.taxCategory = 'פלאפון';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.personalCategory = 'communications';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('GITHUB')) {
    suggestedTransaction.financialEntity = 'GitHub';
    suggestedTransaction.userDescription = 'GitHub Actions';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    if (transaction.event_amount == -450) {
      suggestedTransaction.userDescription = 'Monthly Payment for Yaacov';
    } else if (transaction.event_amount == -4) {
      suggestedTransaction.userDescription = 'GitHub CI charges';
    }
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('גילדה למוצרי תוכנה')
  ) {
    suggestedTransaction.financialEntity = 'Software Products Guilda Ltd.';
    suggestedTransaction.userDescription = 'The Guild work';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('אורי גולדשטיין בע')
  ) {
    suggestedTransaction.financialEntity = 'Uri Goldshgtein LTD';
    suggestedTransaction.userDescription = 'Transaction to company';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('גולדשטין אורי')) {
    suggestedTransaction.financialEntity = 'Uri Goldshgtein';
    suggestedTransaction.userDescription = '10/21 Salary';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = 0;
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('רשם החברות')) {
    suggestedTransaction.financialEntity = 'Israeli Corporations Authority';
    suggestedTransaction.userDescription = 'Company registration yearly fee';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description == 'פועלים- דמי כרטיס') {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.userDescription = 'Bank creditcard fees';
    suggestedTransaction.personalCategory = 'financial';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ארומה')) {
    suggestedTransaction.financialEntity = 'Aroma';
    suggestedTransaction.userDescription = 'Coffee';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('פפואה')) {
    suggestedTransaction.financialEntity = 'פפואה';
    suggestedTransaction.userDescription = 'Coffee';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('סופר פארם')) {
    suggestedTransaction.financialEntity = 'SuperPharm';
    suggestedTransaction.userDescription = 'Personal care';
    suggestedTransaction.personalCategory = 'health';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description == 'חברת פרטנר תקשורת בע') {
    suggestedTransaction.financialEntity = 'Partner';
    suggestedTransaction.personalCategory = 'family';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('GOOGLE FI')) {
    suggestedTransaction.financialEntity = 'Google Fi';
    suggestedTransaction.userDescription = 'Google Fi';
    suggestedTransaction.taxCategory = 'סלולר';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.personalCategory = 'communications';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('העברה מחו"ל') &&
    transaction.detailed_bank_description.includes('SDI PROCUREMEN')
  ) {
    suggestedTransaction.financialEntity = 'sdi procurement solutions';
    suggestedTransaction.taxCategory = 'הכנפט1';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ZOOM')) {
    suggestedTransaction.financialEntity = 'Zoom';
    suggestedTransaction.userDescription = 'Zoom for therapy';
    suggestedTransaction.taxCategory = 'אתר';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.personalCategory = 'love';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('MOUNTAIN V') ||
    transaction.detailed_bank_description.includes('STORA')
  ) {
    suggestedTransaction.financialEntity = 'Google Storage';
    suggestedTransaction.userDescription = 'Google Storage';
    suggestedTransaction.taxCategory = 'אתר';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.personalCategory = 'computer';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description == 'APPLE COM BILL/ITUNES.COM'
  ) {
    suggestedTransaction.financialEntity = 'Apple';
    if (transaction.event_amount == -109.9) {
      suggestedTransaction.userDescription = 'LinkedIn';
      suggestedTransaction.personalCategory = 'business';
    } else {
      suggestedTransaction.userDescription = 'Apple Services';
      suggestedTransaction.personalCategory = 'computer';
    }
    suggestedTransaction.taxCategory = 'אתר';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.vat = '0';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description == 'GETT') {
    suggestedTransaction.financialEntity = 'Gett';
    suggestedTransaction.userDescription = 'Taxi';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.personalCategory = 'transportation';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('סונול')) {
    suggestedTransaction.financialEntity = 'Sonol';
    suggestedTransaction.userDescription = 'Gas';
    suggestedTransaction.personalCategory = 'transportation';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('UBER')) {
    suggestedTransaction.financialEntity = 'Uber';
    suggestedTransaction.userDescription = 'Taxi';
    suggestedTransaction.personalCategory = 'transportation';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ZAPIER')) {
    suggestedTransaction.financialEntity = 'Zapier Inc.';
    suggestedTransaction.userDescription = 'Zapier monthly charge';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('NOTION')) {
    suggestedTransaction.financialEntity = 'Notion Labs Inc.';
    suggestedTransaction.userDescription = 'Notion monthly charge';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ALTINITY')) {
    suggestedTransaction.financialEntity = 'ALTINITY';
    suggestedTransaction.userDescription = 'ALTINITY DB Hosting';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('קרן מכבי- חיוב')) {
    suggestedTransaction.financialEntity = 'Maccabi';
    suggestedTransaction.userDescription = 'Monthly health bill';
    suggestedTransaction.personalCategory = 'health';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('MSFT AZURE')) {
    suggestedTransaction.financialEntity = 'Microsoft Azure';
    suggestedTransaction.userDescription = 'Infrastructure';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('LOOM')) {
    suggestedTransaction.financialEntity = 'Loom';
    suggestedTransaction.userDescription = 'Video recording for business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes("ג'אסט לאנס")) {
    suggestedTransaction.financialEntity = 'JustLance LTD';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('LANCE GLOBAL')) {
    suggestedTransaction.financialEntity = 'Lance Global Inc';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('CRISP')) {
    suggestedTransaction.financialEntity = 'Crisp IM SARL';
    suggestedTransaction.userDescription = 'Monthly Crisp';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('VERCEL')) {
    suggestedTransaction.financialEntity = 'Vercel Inc.';
    suggestedTransaction.userDescription = 'Vercel Hosting';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('הוק האוס אוף קופי')
  ) {
    suggestedTransaction.financialEntity = 'HOC - House Of Coffee';
    suggestedTransaction.userDescription = 'Coffee';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מנטנטו')) {
    suggestedTransaction.financialEntity = 'Men Tenten Ramen Bar';
    suggestedTransaction.userDescription = 'Food';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('משק ברזילי בע"מ')
  ) {
    suggestedTransaction.financialEntity = 'Meshek Barzilay';
    suggestedTransaction.userDescription = 'Food';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('טל יהלום')) {
    suggestedTransaction.financialEntity = 'Tal Yahalom';
    suggestedTransaction.userDescription = 'gift';
    suggestedTransaction.personalCategory = 'family';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('רוני שפירא')) {
    suggestedTransaction.financialEntity = 'Roney Shapira';
    suggestedTransaction.userDescription = 'gift';
    suggestedTransaction.personalCategory = 'family';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('הלמן-אלדובי') &&
    transaction.detailed_bank_description.includes('השתלמות')
  ) {
    suggestedTransaction.financialEntity = 'Halman Aldubi Training Fund';
    suggestedTransaction.financialAccountsToBalance = 'training_fund';
    suggestedTransaction.personalCategory = 'investments';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('הלמן-אלדובי') &&
    transaction.detailed_bank_description.includes('קרן')
  ) {
    suggestedTransaction.financialEntity = 'Halman Aldubi Pension';
    suggestedTransaction.financialAccountsToBalance = 'pension';
    suggestedTransaction.personalCategory = 'investments';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('גרדוש')) {
    suggestedTransaction.financialEntity = 'Gil Gardosh';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.userDescription = 'August Salary';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = '0';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('גלעד תדהר')) {
    suggestedTransaction.financialEntity = 'Gilad Tidhar';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.userDescription = 'August Salary';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = '0';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('PAYPER')) {
    suggestedTransaction.financialEntity = 'Payper';
    suggestedTransaction.userDescription = 'Invoice Management Software';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('העברת מט"ח') &&
    (transaction.detailed_bank_description.includes('fbv') ||
      transaction.detailed_bank_description.includes('fv'))
  ) {
    suggestedTransaction.financialEntity = 'Kamil Kisiela';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('Vignesh')) {
    suggestedTransaction.financialEntity = 'Vignesh T.V.';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('Steinbock Software LTD')
  ) {
    suggestedTransaction.financialEntity = 'Steinbock Software LTD';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מס הכנסה עצ')) {
    suggestedTransaction.financialEntity = 'Tax';
    suggestedTransaction.userDescription = 'Advance Tax for April 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מס הכנסה ני')) {
    suggestedTransaction.financialEntity = 'Tax Deductions';
    suggestedTransaction.userDescription =
      'Tax for employees for March-April 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('המכס ומעמ-גביי תשלום') ||
    transaction.detailed_bank_description.includes('CUSTOM + V.A.T')
  ) {
    suggestedTransaction.financialEntity = 'VAT';
    suggestedTransaction.userDescription = 'VAT for March-April 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מטרי')) {
    suggestedTransaction.financialEntity = 'Yaacov Matri';
    suggestedTransaction.userDescription = 'Consulting';
    suggestedTransaction.personalCategory = 'learn';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.taxCategory = 'יעוץ';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('HEROKU')) {
    suggestedTransaction.financialEntity = 'Heroku';
    suggestedTransaction.userDescription = 'accounter DB';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('JETBRAINS')) {
    suggestedTransaction.financialEntity = 'JetBrains';
    suggestedTransaction.userDescription = 'DataGrip';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('RESCUETIME')) {
    suggestedTransaction.financialEntity = 'RescueTime';
    suggestedTransaction.userDescription = 'Time software';
    suggestedTransaction.personalCategory = 'computer';
    suggestedTransaction.financialAccountsToBalance = ' ';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('חניון')) {
    suggestedTransaction.financialEntity = 'Parking';
    suggestedTransaction.userDescription = 'Parking';
    suggestedTransaction.personalCategory = 'transportation';
    if (transaction.detailed_bank_description.includes('אחוזות החוף')) {
      suggestedTransaction.financialEntity = 'Ahuzot';
    }
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('גיא אברהם')) {
    suggestedTransaction.financialEntity = 'Guy Avraham';
    suggestedTransaction.userDescription = 'Wix Hashavshevet project';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('חשבשבת')) {
    suggestedTransaction.financialEntity = 'Hashavshevet';
    suggestedTransaction.userDescription = 'Accounting app';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('יהל-מור') ||
    transaction.detailed_bank_description.includes('רווה רביד')
  ) {
    suggestedTransaction.financialEntity = 'Raveh Ravid & Co';
    suggestedTransaction.userDescription = 'Accountancy with Narkis';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.taxCategory = 'הנחש';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('GODADDY')) {
    suggestedTransaction.financialEntity = 'GoDaddy';
    suggestedTransaction.userDescription = 'Domain';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.vat = 0;
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('DALET DIGITAL')) {
    suggestedTransaction.financialEntity =
      'Dalet Digital Media Systems USA Inc';
    suggestedTransaction.userDescription = 'Advance Payment - March';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('OUTREACH')) {
    suggestedTransaction.financialEntity = 'Outreach Corporation';
    suggestedTransaction.userDescription =
      'Apollo GraphQL server (aka Giraffe) improvements in Outreach - 1st month';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ard')) {
    suggestedTransaction.financialEntity = 'Arda Tanrikulu';
    suggestedTransaction.userDescription = 'Payment for February 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('עידן')) {
    suggestedTransaction.financialEntity = 'Idan Am-Shalem';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מועדון הבלוק')) {
    suggestedTransaction.financialEntity = 'The Block';
    suggestedTransaction.userDescription = 'Party';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('EVENTBUZZ TICKETS')
  ) {
    suggestedTransaction.financialEntity = 'EVENTBUZZ TICKETS';
    suggestedTransaction.userDescription = 'Party';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('סלון ברלין')) {
    suggestedTransaction.financialEntity = 'סלון ברלין';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('סילון')) {
    suggestedTransaction.financialEntity = 'סילון';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('גוגיס')) {
    suggestedTransaction.financialEntity = 'גוגיס';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('אלברט 1943')) {
    suggestedTransaction.financialEntity = 'אלברט 1943';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('223')) {
    suggestedTransaction.financialEntity = '223 Bar';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('רמפה')) {
    suggestedTransaction.financialEntity = 'Ala Rampa';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('K-BAR')) {
    suggestedTransaction.financialEntity = 'K BAR';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('NETFLIX')) {
    suggestedTransaction.financialEntity = 'Netflix';
    suggestedTransaction.userDescription = 'TV';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('תורגמן יצחק ואברהם')
  ) {
    suggestedTransaction.financialEntity = 'תורגמן יצחק ואברהם';
    suggestedTransaction.userDescription = 'טמבוריה';
    suggestedTransaction.personalCategory = 'house';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('קאופמן מנעולים')) {
    suggestedTransaction.financialEntity = 'קאופמן מנעולים';
    suggestedTransaction.userDescription = 'טמבוריה';
    suggestedTransaction.personalCategory = 'house';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes("חב' חשמל דן חשבונות")
  ) {
    suggestedTransaction.financialEntity = 'חב חשמל דן חשבונות';
    suggestedTransaction.userDescription = 'Electricity bill';
    suggestedTransaction.personalCategory = 'house';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('EUFYLIFE')) {
    suggestedTransaction.financialEntity = 'Eufy';
    suggestedTransaction.userDescription = 'Home Camera';
    suggestedTransaction.personalCategory = 'house';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('NAME COM')) {
    suggestedTransaction.financialEntity = 'NAME COM';
    suggestedTransaction.userDescription = 'Domain';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('SENTRY')) {
    suggestedTransaction.financialEntity = 'Sentry';
    suggestedTransaction.userDescription = 'Monitoring';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('RENDER')) {
    suggestedTransaction.financialEntity = 'Render';
    suggestedTransaction.userDescription = 'Hosting';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ELASTIC')) {
    suggestedTransaction.financialEntity = 'Elasticsearch AS';
    suggestedTransaction.userDescription = 'Hive storage';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('GSUITE') ||
    transaction.detailed_bank_description.includes('GOOGLE CLOUD')
  ) {
    suggestedTransaction.financialEntity = 'Google Ireland Limited';
    suggestedTransaction.userDescription = 'G Suite for The Guild';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('רב-פס')) {
    suggestedTransaction.financialEntity = 'רב-פס';
    suggestedTransaction.userDescription = 'Bus tickets';
    suggestedTransaction.personalCategory = 'transportation';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.taxCategory = 'נסע';
    suggestedTransaction.vat = ((transaction.event_amount / 117) * 17).toFixed(
      2
    );
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('קיוסק קקל')) {
    suggestedTransaction.financialEntity = 'לה קפה';
    suggestedTransaction.userDescription = 'Coffeee';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ספסל בן גוריון')) {
    suggestedTransaction.financialEntity = 'ספסל בן גוריון';
    suggestedTransaction.userDescription = 'Coffee';
    suggestedTransaction.personalCategory = 'food';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('גולדשטיין בן_עמי')
  ) {
    suggestedTransaction.financialEntity = 'Benami Goldshtein';
    suggestedTransaction.userDescription = 'Rent for 09-2021';
    suggestedTransaction.personalCategory = 'house';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('CALENDLY')) {
    suggestedTransaction.financialEntity = 'Calendly LLC';
    suggestedTransaction.userDescription = 'Calendar service';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('קיי אס פי מחשבים')
  ) {
    suggestedTransaction.financialEntity = 'KSP';
    suggestedTransaction.userDescription = 'Computer';
    suggestedTransaction.personalCategory = 'computer';
    suggestedTransaction.financialAccountsToBalance = ' ';
    return suggestedTransaction;
  } else if (transaction.event_amount == -600) {
    suggestedTransaction.financialEntity = 'Zaum';
    suggestedTransaction.userDescription = 'Matic Zavadlal - April 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else {
    suggestedTransaction.financialEntity = transaction.detailed_bank_description
      .replaceAll(`"`, '')
      .replaceAll(`'`, '');
    suggestedTransaction.userDescription = 'Food';
    suggestedTransaction.personalCategory = 'food';

    if (transaction.is_conversion) {
      suggestedTransaction.financialEntity = 'Poalim';
      suggestedTransaction.userDescription = 'Conversion for ';
      suggestedTransaction.personalCategory = 'conversion';
    }
    return suggestedTransaction;
  }
}

const businessesWithoutVAT = [
  'Apple',
  'Halman Aldubi Training Fund',
  'Halman Aldubi Pension',
  'Social Security Deductions',
  'Tax Deductions',
];
function isBusiness(transaction: any) {
  return (
    (transaction.account_number == 61066 ||
      transaction.account_number == 2733 ||
      transaction.account_number == 466803 ||
      transaction.account_number == 1082 ||
      transaction.account_number == 1074) &&
    !entitiesWithoutInvoice.includes(transaction.financial_entity)
  );
}
function shareWithDotan(transaction: any) {
  if (
    transaction.financial_accounts_to_balance == 'no' ||
    transaction.financial_accounts_to_balance === ' ' ||
    transaction.financial_accounts_to_balance === 'yes' ||
    transaction.financial_accounts_to_balance === 'pension' ||
    transaction.financial_accounts_to_balance === 'training_fund'
  ) {
    return false;
  } else {
    return !(
      !isBusiness(transaction) ||
      privateBusinessExpenses.includes(transaction.financial_entity) ||
      businessesNotToShare.includes(transaction.financial_entity) ||
      businessesWithoutTaxCategory.includes(transaction.financial_entity)
    );
  }
}

export function currencyCodeToSymbol(currency_code: string): string {
  let currencySymbol = '₪';
  if (currency_code == 'USD') {
    currencySymbol = '$';
  } else if (currency_code == 'EUR') {
    currencySymbol = '€';
  }
  return currencySymbol;
}

export const tableStyles = `
<style>
  table {
    border-collapse: collapse;
    background-color: #EEEEEE;
  }
  th, td {
    border: 1px solid black;
  }
  th {
    font-size: 10px;
    background-color: #4F7849;
    color: white;
    position: sticky;
    top: 0;
  }
  td {
    text-align: center;
    font-size: 14px;
  }
  tr:hover {background-color: #f5f5f5;}
  tr:nth-child(even) {background-color: #CEE0CC;}

  table.taxes th {
    background-color: #93a191;
  }

  table.taxes th, td {
    border: 0.5px solid gray;
  }
</style>
`;

export const lastInvoiceNumbersQuery = `
  SELECT tax_invoice_number,
    user_description,
    financial_entity,
    event_amount,
    event_date
  FROM accounter_schema.all_transactions
  WHERE
    (account_number in ('466803', '1074', '1082')) AND
    event_amount > 0 AND
    (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
  ORDER BY event_date DESC;
`;

export function getLastInvoiceNumbers(lastInvoiceNumbers: any) {
  let lastInvoiceNumbersHTMLTemplate = '';
  if (lastInvoiceNumbers?.rows) {
    for (const transaction of lastInvoiceNumbers?.rows) {
      lastInvoiceNumbersHTMLTemplate = lastInvoiceNumbersHTMLTemplate.concat(`
        <tr>
          <td>${transaction.tax_invoice_number}</td>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
          <td>${transaction.event_amount}</td>
        </tr>
        `);
    }
  }
  lastInvoiceNumbersHTMLTemplate = `
      <table>
        <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Date</th>
              <th>Entity</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${lastInvoiceNumbersHTMLTemplate}
        </tbody>
      </table>  
    `;
  return lastInvoiceNumbersHTMLTemplate;
}

export const financialStatus = async (query: any): Promise<string> => {
  let monthTaxReport;
  if (query.month) {
    // TODO: Fix this stupid month calculation
    monthTaxReport = `2020-0${query.month}-01`;
  } else {
    monthTaxReport = '2021-08-01';
  }
  console.log('monthTaxReport', monthTaxReport);
  // const currentVATStatusQuery = readFileSync(
  //   'src/sql/currentVATStatus.sql'
  // ).toString();

  console.time('callingDB');

  const results: any = await Promise.allSettled([
    pool.query(
      `
        select *
        from missing_invoice_dates($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(
      `
        select *
        from missing_invoice_numbers($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(lastInvoiceNumbersQuery),
    // pool.query(currentVATStatusQuery),
    pool.query(
      `
        select *
        from get_vat_for_month($1);
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(`
      select *
      from accounter_schema.all_transactions
      -- where account_number in ('466803', '1074', '1082')
      order by event_date desc
      limit 2550;
    `),
    pool.query(
      `
        select *
        from missing_invoice_images($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(readFileSync('src/monthlyCharts.sql').toString()),
    pool.query(`
    with transactions_exclude as (
      select *
      from formatted_merged_tables
      where
          personal_category <> 'conversion' and
          personal_category <> 'investments' and
          financial_entity <> 'Isracard' and
          financial_entity <> 'Tax' and
          financial_entity <> 'VAT' and
          financial_entity <> 'Tax Shuma' and
          financial_entity <> 'Tax Corona Grant' and
          financial_entity <> 'Uri Goldshtein' and
          financial_entity <> 'Uri Goldshtein Hoz' and
          financial_entity <> 'Social Security Deductions' and
          financial_entity <> 'Tax Deductions' and
          financial_entity <> 'Dotan Simha' and
          personal_category <> 'business'
  )
  select
      personal_category,
      sum(event_amount_in_usd_with_vat_if_exists)::float4 as overall_sum
  from transactions_exclude
  where
    event_date::text::date >= '2021-08-01'::text::date and
    event_date::text::date <= '2021-08-31'::text::date
  --   and personal_category = 'family'
  group by personal_category
  order by sum(event_amount_in_usd_with_vat_if_exists);    
    `),
  ]);

  let missingInvoiceDates: any = results[0].value;
  let missingInvoiceNumbers: any = results[1].value;
  let lastInvoiceNumbers: any = results[2].value;
  // let currentVATStatus: any = results[3].value;
  let VATTransactions: any = results[3].value;
  let allTransactions: any = results[4].value;
  let missingInvoiceImages: any = results[5].value;
  let profitTable: any = results[6].value;
  let thisMonthPrivateExpensesTable: any = results[7].value;

  console.timeEnd('callingDB');

  var formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  let profitTableHTMLTemplate = '';
  if (profitTable?.rows) {
    for (const profitMonth of profitTable?.rows) {
      profitTableHTMLTemplate = profitTableHTMLTemplate.concat(`
        <tr>
            <td>${profitMonth.date}</td>
            <td>${formatter.format(profitMonth.business_income)}</td>
            <td>${formatter.format(profitMonth.business_expenses)}</td>
          <td>${formatter.format(profitMonth.overall_business_profit)}</td>
          <td>${formatter.format(profitMonth.business_profit_share)}</td>
          <td>${formatter.format(profitMonth.private_expenses)}</td>
          <td>${formatter.format(profitMonth.overall_private)}</td>
        </tr>
        `);
    }
    profitTableHTMLTemplate = `
    <table>
      <thead>
          <tr>
              <th>Date</th>
              <th>Business Income</th>
              <th>Business Expenses</th>
              <th>overall_business_profit</th>
              <th>business_profit_share</th>
              <th>private_expenses</th>
              <th>overall_private</th>
              </tr>
      </thead>
      <tbody>
          ${profitTableHTMLTemplate}
      </tbody>
    </table>  
  `;
  }

  let thisMonthPrivateExpensesTableHTMLTemplate = '';
  if (thisMonthPrivateExpensesTable?.rows) {
    for (const expenseCategory of thisMonthPrivateExpensesTable?.rows) {
      thisMonthPrivateExpensesTableHTMLTemplate =
        thisMonthPrivateExpensesTableHTMLTemplate.concat(`
        <tr>
            <td>${expenseCategory.personal_category}</td>
            <td>${formatter.format(expenseCategory.overall_sum)}</td>
        </tr>
        `);
    }
    thisMonthPrivateExpensesTableHTMLTemplate = `
    <table>
      <thead>
          <tr>
              <th>Personal Category</th>
              <th>Amount</th>
              </tr>
      </thead>
      <tbody>
          ${thisMonthPrivateExpensesTableHTMLTemplate}
      </tbody>
    </table>  
  `;
  }

  let missingInvoiceDatesHTMLTemplate = '';
  if (missingInvoiceDates?.rows) {
    for (const transaction of missingInvoiceDates?.rows) {
      missingInvoiceDatesHTMLTemplate = missingInvoiceDatesHTMLTemplate.concat(`
        <tr>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
        transaction.currency_code
      )}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
          <td>${transaction.tax_invoice_number}</td>
        </tr>
        `);
    }
  }
  missingInvoiceDatesHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
                <th>Invoice Number</th>
            </tr>
        </thead>
        <tbody>
            ${missingInvoiceDatesHTMLTemplate}
        </tbody>
      </table>  
    `;

  let missingInvoiceNumbersHTMLTemplate = '';
  if (missingInvoiceNumbers?.rows) {
    for (const transaction of missingInvoiceNumbers?.rows) {
      missingInvoiceNumbersHTMLTemplate =
        missingInvoiceNumbersHTMLTemplate.concat(`
        <tr>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
          transaction.currency_code
        )}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
          <td>${transaction.tax_invoice_number}</td>
        </tr>
        `);
    }
  }
  missingInvoiceNumbersHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
                <th>Invoice Number</th>
            </tr>
        </thead>
        <tbody>
            ${missingInvoiceNumbersHTMLTemplate}
        </tbody>
      </table>  
    `;

  let missingInvoiceImagesHTMLTemplate = '';
  if (missingInvoiceImages?.rows) {
    for (const transaction of missingInvoiceImages?.rows) {
      missingInvoiceImagesHTMLTemplate =
        missingInvoiceImagesHTMLTemplate.concat(`
          <tr>
            <td>${transaction.event_date
              .toISOString()
              .replace(/T/, ' ')
              .replace(/\..+/, '')}</td>
            <td>${transaction.event_amount}${currencyCodeToSymbol(
          transaction.currency_code
        )}</td>
            <td>${transaction.financial_entity}</td>
            <td>${transaction.user_description}</td>
            <td>${transaction.tax_invoice_number}</td>
          </tr>
          `);
    }
  }
  missingInvoiceImagesHTMLTemplate = `
        <table>
          <thead>
              <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Entity</th>
                  <th>Description</th>
                  <th>Invoice Number</th>
              </tr>
          </thead>
          <tbody>
              ${missingInvoiceImagesHTMLTemplate}
          </tbody>
        </table>  
      `;

  let VATTransactionsString = '';
  if (VATTransactions?.rows) {
    for (const transaction of VATTransactions?.rows) {
      VATTransactionsString = VATTransactionsString.concat(`
        <tr>
          <td>${transaction.overall_vat_status}</td>
          <td>${transaction.vat}</td>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
        </tr>
        `);
    }
  }
  VATTransactionsString = `
      <table>
        <thead>
            <tr>
                <th>Overall VAT Status</th>
                <th>VAT</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            ${VATTransactionsString}
        </tbody>
      </table>  
    `;

  let allTransactionsString = '';
  if (allTransactions?.rows) {
    for (const transaction of allTransactions?.rows) {
      allTransactionsString = allTransactionsString.concat(`
        <tr bank_reference=${transaction.bank_reference}
            account_number=${transaction.account_number}
            account_type=${transaction.account_type}
            currency_code=${transaction.currency_code}
            event_date=${transaction.event_date
              .toISOString()
              .replace(/T/, ' ')
              .replace(/\..+/, '')}
            event_amount=${transaction.event_amount}
            event_number=${transaction.event_number}
            transaction_id=${transaction.id}>
          <td>
            ${moment(transaction.event_date).format('DD/MM/YY')}
            ${
              transaction.debit_date
                ? `<div style="font-size: 12px; color: gray;">` +
                  moment(transaction.debit_date).format('DD/MM/YY') +
                  `</div>`
                : ''
            }
          </td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
        transaction.currency_code
      )}</td>
          <td class="financial_entity" ${
            transaction.financial_entity
              ? ''
              : 'style="background-color: rgb(236, 207, 57);"'
          }>${
        transaction.financial_entity
          ? transaction.financial_entity
          : `${
              suggestedTransaction(transaction)?.financialEntity
            } <button type="button" onClick='printElement(this, "${
              suggestedTransaction(transaction)?.financialEntity
            }");'>V</button>`
      }
            <button type="button" onClick='printElement(this, prompt("New financial entity:"));'>&#x270f;</button>
          </td>
          <td class="user_description" ${
            transaction.user_description
              ? ''
              : 'style="background-color: rgb(236, 207, 57);"'
          }>${
        transaction.user_description
          ? transaction.user_description
          : `${
              suggestedTransaction(transaction)?.userDescription
            } <button type="button" onClick='printElement(this, "${
              suggestedTransaction(transaction)?.userDescription
            }");'>V</button>`
      }
            <button type="button" onClick='printElement(this, prompt("New user description:"));'>&#x270f;</button>
          </td>
          <td class="personal_category" ${
            transaction.personal_category
              ? ''
              : 'style="background-color: rgb(236, 207, 57);"'
          }>${
        transaction.personal_category
          ? transaction.personal_category
          : `${
              suggestedTransaction(transaction)?.personalCategory
            } <button type="button" onClick='printElement(this, "${
              suggestedTransaction(transaction)?.personalCategory
            }");'>V</button>`
      }
            <button type="button" onClick='printElement(this, prompt("New personal category:"));'>&#x270f;</button>
          </td>
          <td class="vat"  ${
            (!transaction.vat &&
              isBusiness(transaction) &&
              !businessesWithoutVAT.includes(transaction.financial_entity) &&
              !businessesWithoutTaxCategory.includes(
                transaction.financial_entity
              )) ||
            (transaction.vat > 0 && transaction.event_amount < 0) ||
            (transaction.vat < 0 && transaction.event_amount > 0)
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>${
        transaction.vat
          ? transaction.vat
          : `${
              suggestedTransaction(transaction)?.vat
            } <button type="button" onClick='printElement(this, "${
              suggestedTransaction(transaction)?.vat
            }");'>V</button>`
      }
            <button type="button" onClick='printElement(this, prompt("New VAT:"));'>&#x270f;</button>
          </td>
          <td>${transaction.account_number}${transaction.account_type}</td>
          <td class="financial_accounts_to_balance" ${
            shareWithDotan(transaction)
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>${
        transaction.financial_accounts_to_balance
          ? transaction.financial_accounts_to_balance
          : `${
              suggestedTransaction(transaction)?.financialAccountsToBalance
            } <button type="button" onClick='printElement(this, "${
              suggestedTransaction(transaction)?.financialAccountsToBalance
            }");'>V</button>`
      }
            <button type="button" onClick='printElement(this, prompt("New Account to share:"));'>&#x270f;</button>
          </td>
          <td class="tax_category">${transaction.tax_category}
            <button type="button" onClick='printElement(this, prompt("New Tax category:"));'>&#x270f;</button>
          </td>
          <td>${transaction.detailed_bank_description}</td>
          <td class="proforma_invoice_file" ${
            isBusiness(transaction) && !transaction.proforma_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.proforma_invoice_file
                ? `<a href="${transaction.proforma_invoice_file}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice Photo:"));'>&#x270f;</button>
          </td>
          <td class="tax_invoice_date" ${
            isBusiness(transaction) && !transaction.tax_invoice_date
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>${
        transaction.tax_invoice_date
          ? moment(transaction.tax_invoice_date).format('DD/MM/YY')
          : ''
      }
            <button type="button" onClick='printElement(this, prompt("New Invoice Date:"));'>&#x270f;</button>
          </td>
          <td class="tax_invoice_number" ${
            isBusiness(transaction) &&
            !entitiesWithoutInvoiceNumuber.includes(
              transaction.financial_entity
            ) &&
            !transaction.tax_invoice_number
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.tax_invoice_number}
            <button type="button" onClick='printElement(this, prompt("New Invoice Number:"));'>&#x270f;</button>
          </td>
          <td class="tax_invoice_file" ${
            isBusiness(transaction) && !transaction.tax_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.tax_invoice_file
                ? `<a href="${transaction.tax_invoice_file}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice path:"));'>&#x270f;</button>
          </td>

          <td class="receipt_image" ${
            isBusiness(transaction) &&
            !transaction.receipt_image &&
            !transaction.proforma_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.receipt_image
                ? `<a href="${transaction.receipt_image}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice Photo:"));'>&#x270f;</button>
          </td>
          <td class="receipt_date" ${
            isBusiness(transaction) &&
            !transaction.receipt_date &&
            !transaction.tax_invoice_date
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>${
        transaction.receipt_date
          ? moment(transaction.receipt_date).format('DD/MM/YY')
          : ''
      }
            <button type="button" onClick='printElement(this, prompt("New Invoice Date:"));'>&#x270f;</button>
          </td>
          <td class="receipt_number" ${
            isBusiness(transaction) &&
            !entitiesWithoutInvoiceNumuber.includes(
              transaction.financial_entity
            ) &&
            !transaction.receipt_number &&
            !transaction.tax_invoice_number
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.receipt_number}
            <button type="button" onClick='printElement(this, prompt("New Invoice Number:"));'>&#x270f;</button>
          </td>
          <td class="receipt_url" ${
            isBusiness(transaction) &&
            !transaction.receipt_url &&
            !transaction.tax_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.receipt_url
                ? `<a href="${transaction.receipt_url}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice path:"));'>&#x270f;</button>
          </td>
          
          
          <td class="links">
            ${transaction.links ? 'yes' : ''}
            <button type="button" onClick='printElement(this, prompt("New links:"));'>&#x270f;</button>
            <button type="button" onClick='updateClipboard("${
              transaction.links
            }");'>&#9986;</button>
          </td>          
        </tr>
        <!--
        <tr>
          <td colspan="15">
            <table class="taxes">
              <thead>
                <tr>
                  <th>מספר</th>
                  <th>תקין</th>
                  <th>תאריך_חשבונית</th>
                  <th>חשבון_חובה_1</th>
                  <th>סכום_חובה_1</th>
                  <th>מטח_סכום_חובה_1</th>
                  <th>מטבע</th>
                  <th>חשבון_זכות_1</th>
                  <th>סכום_זכות_1</th>
                  <th>מטח_סכום_זכות_1</th>
                  <th>חשבון_חובה_2</th>
                  <th>סכום_חובה_2</th>
                  <th>מטח_סכום_חובה_2</th>
                  <th>חשבון_זכות_2</th>
                  <th>סכום_זכות_2</th>
                  <th>מטח_סכום_זכות_2</th>
                  <th>פרטים</th>
                  <th>אסמכתא_1</th>
                  <th>אסמכתא_2</th>
                  <th>סוג_תנועה</th>
                  <th>תאריך_ערך</th>
                  <th>תאריך_3</th>
                  <th>חשבשבת</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                </tr>
              </tbody>
            </table>   
          </td>
        </tr>
        -->
        `);
    }
  }
  allTransactionsString = `
      <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
                <th>Category</th>
                <th>VAT</th>
                <th>Account</th>
                <th>Share with</th>
                <th>Tax category</th>
                <th>Bank Description</th>
                <th>Invoice Img</th>
                <th>Invoice Date</th>
                <th>Invoice Number</th>
                <th>Invoice File</th>
                <th>Receipt Image</th>
                <th>Receipt Date</th>
                <th>Receipt Number</th>
                <th>Receipt URL</th>
                <th>Links</th>
            </tr>
        </thead>
        <tbody>
            ${allTransactionsString}
        </tbody>
      </table>  
    `;

  return `

      ${tableStyles}

      <h1>Accounter</h1>

      <a href="/reports-to-review">Monthly report to review</a>

      <a href="/private-charts">Private Charts</a>
  
      ${profitTableHTMLTemplate}

      <br> 

      ${thisMonthPrivateExpensesTableHTMLTemplate}

      <h3>Missing invoice numbers for a month</h3>
  
      ${missingInvoiceNumbersHTMLTemplate}
  
      <h3>Missing invoice dates for a month</h3>
  
      ${missingInvoiceDatesHTMLTemplate}

      <h3>Missing invoice images</h3>

      ${missingInvoiceImagesHTMLTemplate}
  
      <h3>Last invoice numbers</h3>
  
      ${getLastInvoiceNumbers(lastInvoiceNumbers)}
  
      <h3>VAT Transactions for this month:</h3>
  
      ${VATTransactionsString}
  
      <h3>All Transactions</h3>
  
      ${allTransactionsString}
  
      <script type="module" src="/browser.js"></script>
      <script type="module">
        import { printElement, updateClipboard } from '/browser.js';
  
        window.printElement = printElement;
        window.updateClipboard = updateClipboard;
      </script>
    `;
};
