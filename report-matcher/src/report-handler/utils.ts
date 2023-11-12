export function cleanField(raw: string, trimZeros = false): string {
  const trimmed = raw.trim();
  const firstChar = trimmed[0];
  if (firstChar === ' ') {
    return '';
  }
  if (firstChar === '0' && trimZeros) {
    let extraTrimmed = trimmed;
    while (extraTrimmed[0] === '0') {
      extraTrimmed = extraTrimmed.slice(1);
    }
    return extraTrimmed;
  }
  return trimmed;
}

export const accountsDict: Map<string, string[]> = new Map<string, string[]>([
  ['Accounting', ['הנחש']],
  ['ActiveCampaign, LLC', []],
  ['Ahrefs Pte. Ltd.', ['Ahrefs']],
  ['Air France', ['AIR']],
  ['AirBמB', ['AIRBNB']],
  ['Altinity Inc', ['Vercel Inc.']],
  ['Amazon Web Services EMEA SARL', ['AWS']],
  ['Amazon.com', ['Amazon.com']],
  ['Arda Tanrikulu', ['Arda Tanrikulu']],
  ['Avi Peretz', ['Avi Peretz']],
  ['Business Insurance', ['ביטוח עסק']],
  ['Business Trip', ['נסעחול1', 'נסעחול2', 'נסעחול3', 'נסעחול4', 'נסעחול5']],
  ['Cal.com, Inc.', ['CAL']],
  ['Calendly LLC', ['Calendly LLC']],
  ['ClickHouse, Inc.', ['CLICKHOUSE']],
  ['Cloudflare, Inc.', ['Cloudflare, Inc']],
  ['Consultancy', ['יעוץ']],
  ['Crisp IM SARL', ['Crisp IM SARL']],
  ['Dalet Digital Media Systems USA Inc', ['Dalet Digital M']],
  ['Deel Germany GmbH', ['Deel Germany Gm']],
  ['denelop o.d.', ['Denelop']],
  ['Development', ['פיתוח']],
  ['Development Israel', ['פיתוחארץ']],
  ['DHL (Israel) LTD', ['DHL (Israel) LT']],
  ['Dividend Tax Deduction Origin', ['ניבמדיב']],
  ['Dotan Dividend', ['Dotan Dividend']],
  ['Dotan Employee', ['DotanEm']],
  ['EIRL Charly Poly Engineering EIRL', ['EIRL Charly Pol']],
  ['Exchange Rates', ['שער']],
  ['Gett', ['נסע']],
  ['Gil Employee', ['GilEm']],
  ['Gilad Employee', ['GiladEm']],
  ['GitHub, Inc', ['GitHub']],
  ['GoDaddy.com, LLC', ['GoDaddy']],
  ['Google Cloud EMEA Limited', ['Google Ireland']],
  ['Gornitzky & Co., Advocates', ['Gornitzky & Co.']],
  ['Green Invoice', ['Green Invoice']],
  ['Heroku', ['Heroku']],
  ['Income no VAT', ['הכנפט']],
  ['Idan Am-Shalem', ['Idan Am-Shalem']],
  ['Isracard', ['כא1074', 'כא1082']], // TODO: duplication between "Isracard" and the cards as individuals
  ['Jelly JS Kamil Kisiela', ['Jelly JS Kamil']],
  ['Lance Global Inc', ['Lance Global In']],
  ['LaunchMade Web Services', ['LaunchMade Web']],
  ['Legal', ['משפט']],
  ['Maintenance', ['אחזקה']],
  ['Marks and Spencer PLC', ['Marks and Spenc']],
  ['Meetup', ['Meetup']],
  ['Michael Chan', ['Michael Chan']],
  ['Microsoft Azure', ['Microsoft Azure']],
  ['Notion Labs, Inc', ['Notion Labs, In']],
  ['Office', ['משרד']],
  ['Outreach Corporation', ['Outreach Corpor']],
  ['Payper', ['Payper']],
  ['Poalim', ['עמל']],
  ['Pulumi Corporation', ['Pulumi Comporat']],
  ['Raintank Inc dba Grafana Labs', ['Raintank Inc db']],
  ['Raveh Ravid & Co', ['Raveh Ravid & C']],
  ['Render', ['Render']],
  ['Rent', ['שכר דירה']],
  ['Retool Inc', ['Retool']],
  ['Saihajpreet Singh', ['Saihajpreet Sin']],
  ['Sentry', ['Sentry']],
  ['Slack Technologies Limited', ['Slack']],
  ['SLAVA UKRAINI', ['Slava Ukraini']],
  ['Social Security Deductions', ['בלני']],
  ['Tamal', ['Tamal']],
  ['Tax', ['מקדמות2022', 'מקדמותעח', 'מקדמה לשלם 21', 'קנס מס הכנסה']], // TODO: multiple tax accounts
  ['Tax Deductions', ['מהני']],
  ['The Graph Foundation', ['The Graph Found']],
  ['The Linux Foundation', ['Linux Foundatio']],
  ['Tuval Employee', ['TuvalEm']],
  ['Uri Dividend', ['Uri Dividend']],
  ['Uri Employee', ['UriEm']],
  ['VAT', ['מעמחוז', 'ריביתמעמ']], // TODO: multiple tax accounts + duplication with מעמ
  ['Vercel Inc.', ['Vercel Inc.']],
  ['Website', ['אתר']],
  ['Y.T AMIRIM DISTRIBUTION LTD', ['Y.T.Amirim']],
  ['Yahel Mor', ['Yahel Mor']],
  ['Yassin Eldeeb', ['YASSIN']],
  ['Yossi Yaron', []],
  ['אחזקת מחשב', ['אחזקת מחשב']],
  ['איילון פנסיה', ['איילוןפ']],
  ['ביקורת', ['ביקורת']],
  ['דטה פרינט בעמ', ['דטה פרינט בעמ']],
  ['דמי חבר', ['דמי חבר']],
  ['הפניקס חברה לביטוח בע"מ', ['הפניקס']],
  ['כא1074', ['כא1074']],
  ['כא1082', ['כא1082']],
  ['כא5972', ['כא5972']],
  ['מגדל השתלמות', ['מגדלהש']],
  ['מגדל פנסיה', ['מגדלפנ']],
  ['מחשבים', ['מחשבים']],
  ['מנורה פנסיה', ['מנורהפנ']],
  ['מעמ', ['מעמחוז', 'תשו']],
  ['עוש', ['עוש']],
  ['עוש1', ['עוש1']],
  ['עוש2', ['עוש2']],
  ['עוש3', ['עוש3']],
  ['פניקס השתלמות', ['פניקסהש']],
  ['קריפטו1', ['קריפטו1']],
]);

export function checkAccountsMatch(
  movementAccount: string,
  ledgerAccount?: string | null,
): boolean {
  if (!ledgerAccount) {
    return false;
  }

  const options = accountsDict.get(ledgerAccount);
  if (!options) {
    return false;
  }
  if (options.includes(movementAccount)) {
    return true;
  }
  return false;
}
