import { AllTransactionsEntity } from './getAllTransactions';

export const businessesWithoutTaxCategory = [
  'Uri Goldshtein',
  'Social Security Deductions',
  'Tax Deductions',
  'VAT',
  'Tax',
];

const entitiesWithoutInvoice = [
  'Poalim',
  'Isracard',
  'Tax Deductions',
  'Tax',
  'VAT',
];

export const entitiesWithoutInvoiceNumuber = ['Uri Goldshtein'];

export const isBusiness = (transaction: AllTransactionsEntity) => {
  return (
    (transaction.account_number == 61066 ||
      transaction.account_number == 2733 ||
      transaction.account_number == 466803 ||
      transaction.account_number == 1082 ||
      transaction.account_number == 1074) &&
    !entitiesWithoutInvoice.includes(transaction.financial_entity || '')
  );
};

export const suggestedTransaction = (transaction: AllTransactionsEntity) => {
  const suggestedTransaction: {
    financialEntity?: string;
    userDescription?: string;
    financialAccountsToBalance?: string;
    personalCategory?: string;
    vat?: string;
    taxCategory?: string;
  } = {};
  if (transaction.detailed_bank_description == 'SLACK TAYJ1FSUA/DUBLIN') {
    suggestedTransaction.financialEntity = 'Slack';
    suggestedTransaction.userDescription = 'Slack';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('WOLT')) {
    suggestedTransaction.financialEntity = 'Wolt';
    suggestedTransaction.userDescription = 'Wolt';
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description == `ע' העברת מט"ח` ||
    (transaction.detailed_bank_description.includes(`העברת מט"ח`) &&
      Math.abs(Number(transaction.event_amount)) < 200) ||
    (transaction.detailed_bank_description.includes('מטח') &&
      Math.abs(Number(transaction.event_amount)) < 200) ||
    transaction.detailed_bank_description.includes('F.C.COM') ||
    transaction.detailed_bank_description.includes('ע.מפעולות-ישיר') ||
    transaction.detailed_bank_description.includes('ריבית חובה')
  ) {
    suggestedTransaction.financialEntity = 'Poalim';
    suggestedTransaction.personalCategory = 'financial';
    suggestedTransaction.userDescription = `Fees for bank_reference=${transaction.bank_reference}`;
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
    suggestedTransaction.userDescription = 'Monthly creditcard charge';
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('GITHUB')) {
    suggestedTransaction.financialEntity = 'GitHub';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.personalCategory = 'business';
    if (Number(transaction.event_amount) == -450) {
      suggestedTransaction.userDescription = 'Monthly Payment for Yaacov';
    } else if (Number(transaction.event_amount) == -4) {
      suggestedTransaction.userDescription = 'GitHub CI charges';
    }
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description == 'פועלים- דמי כרטיס') {
    suggestedTransaction.financialEntity = 'Poalim';
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
    suggestedTransaction.financialEntity = 'Super-Pharm';
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
    if (Number(transaction.event_amount) == -109.9) {
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('סונול')) {
    suggestedTransaction.financialEntity = 'Sonol';
    suggestedTransaction.userDescription = 'Gas';
    suggestedTransaction.personalCategory = 'transportation';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('ZAPIER')) {
    suggestedTransaction.financialEntity = 'Zapier Inc.';
    suggestedTransaction.userDescription = 'Zapier monthly charge';
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
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
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.vat = '0';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('העברת מט"ח') &&
    transaction.detailed_bank_description.includes('fv')
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('HEROKU')) {
    suggestedTransaction.financialEntity = 'Heroku';
    suggestedTransaction.userDescription = 'accounter DB';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.taxCategory = 'אתר';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('חניון')) {
    suggestedTransaction.financialEntity = 'Parking';
    suggestedTransaction.userDescription = 'Parking';
    suggestedTransaction.personalCategory = 'transportation';
    if (transaction.detailed_bank_description.includes('אחוזות החוף')) {
      suggestedTransaction.financialEntity = 'Ahuzot';
    }
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('חשבשבת')) {
    suggestedTransaction.financialEntity = 'Hashavshevet';
    suggestedTransaction.userDescription = 'Accounting app';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('יהל-מור')) {
    suggestedTransaction.financialEntity = 'Raveh Ravid & Co';
    suggestedTransaction.userDescription = 'Accountancy with Narkis';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.taxCategory = 'הנחש';
    suggestedTransaction.financialAccountsToBalance = 'no';
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('GODADDY')) {
    suggestedTransaction.financialEntity = 'GoDaddy';
    suggestedTransaction.userDescription = 'Domain';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('DALET DIGITAL')) {
    suggestedTransaction.financialEntity =
      'Dalet Digital Media Systems USA Inc';
    suggestedTransaction.userDescription = 'Advance Payment - March';
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
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('מועדון הבלוק')) {
    suggestedTransaction.financialEntity = 'The Block';
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
  } else if (transaction.detailed_bank_description.includes('אלברט 1943')) {
    suggestedTransaction.financialEntity = 'אלברט 1943';
    suggestedTransaction.userDescription = 'Bar';
    suggestedTransaction.personalCategory = 'fun';
    return suggestedTransaction;
  } else if (
    transaction.detailed_bank_description.includes('תורגמן יצחק ואברהם')
  ) {
    suggestedTransaction.financialEntity = 'תורגמן יצחק ואברהם';
    suggestedTransaction.userDescription = 'טמבוריה';
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
    suggestedTransaction.financialEntity = 'Google';
    suggestedTransaction.userDescription = 'G Suite for The Guild';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('גיא אברהם')) {
    suggestedTransaction.financialEntity = 'Guy Avraham';
    suggestedTransaction.userDescription = 'Wix Hashavshevet project';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (transaction.detailed_bank_description.includes('רב-פס')) {
    suggestedTransaction.financialEntity = 'רב-פס';
    suggestedTransaction.userDescription = 'Bus tickets';
    suggestedTransaction.personalCategory = 'transportation';
    suggestedTransaction.financialAccountsToBalance = ' ';
    suggestedTransaction.taxCategory = 'נסע';
    suggestedTransaction.vat = (
      (Number(transaction.event_amount) / 117) *
      17
    ).toFixed(2);
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
  } else if (transaction.detailed_bank_description.includes('CALENDLY')) {
    suggestedTransaction.financialEntity = 'Calendly LLC';
    suggestedTransaction.userDescription = 'Calendar service';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else if (Number(transaction.event_amount) == -600) {
    suggestedTransaction.financialEntity = 'Zaum';
    suggestedTransaction.userDescription = 'Matic Zavadlal - April 2021';
    suggestedTransaction.personalCategory = 'business';
    suggestedTransaction.financialAccountsToBalance = 'no';
    return suggestedTransaction;
  } else {
    suggestedTransaction.financialEntity = transaction.detailed_bank_description
      .split(`"`)
      .join('')
      .split(`'`)
      .join('');
    suggestedTransaction.userDescription = 'Food';
    suggestedTransaction.personalCategory = 'food';

    if (transaction.is_conversion) {
      suggestedTransaction.financialEntity = 'Poalim';
      suggestedTransaction.userDescription = 'Conversion for ';
      suggestedTransaction.personalCategory = 'conversion';
    }
    return suggestedTransaction;
  }
};
