import {
  BadgeDollarSign,
  Banknote,
  BarChartBig,
  Bitcoin,
  Building2,
  Calculator,
  Coins,
  FileCheck2,
  Files,
  HandCoins,
  Handshake,
  Landmark,
  Mail,
  PlaneTakeoff,
  Puzzle,
  Receipt,
  ReceiptText,
  Scale,
  ScanText,
  type LucideIcon,
} from 'lucide-react';

/**
 * Copy for the public landing page, kept out of the JSX so wording can be edited
 * without touching layout. Nothing here is fetched — the page is static by design.
 *
 * The page is bilingual: every visitor-facing string lives twice, under
 * `CONTENT.he` (the default) and `CONTENT.en`. Components read the active copy
 * through `useLandingContent()` and never hardcode prose.
 */

/**
 * Accounter is invitation-only (see `screens/welcome.tsx`), so this is the only
 * way in for a visitor without an account. `accounter.tax` already runs
 * Cloudflare Email Routing for the per-tenant ingestion aliases, so an alias on
 * the same zone is the cheapest destination to keep working.
 */
export const REQUEST_ACCESS_URL = 'mailto:hello@accounter.tax';

export const GITHUB_URL = 'https://github.com/Urigo/accounter-fullstack';

export const MCP_URL = 'https://mcp.accounter.tax';

export type LandingLang = 'en' | 'he';

/** Tool names are product identifiers, so they read the same in both languages. */
export const MCP_TOOLS: string[] = [
  'search charges',
  'get transactions',
  'get documents',
  'get ledger records',
  'balance report',
  'list businesses',
  'list tags',
  'get contracts',
];

export type LandingSection = {
  id: string;
  label: string;
};

export type SectionHeadingContent = {
  eyebrow: string;
  title: string;
  description?: string;
};

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type IntegrationGroup = {
  icon: LucideIcon;
  title: string;
  items: string[];
  /** Renders a trailing "and more" so a sampled list does not read as the full set. */
  andMore?: boolean;
};

export type ComplianceItem = {
  title: string;
  description: string;
};

export type Pillar = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type PipelineStage = {
  icon: LucideIcon;
  label: string;
  caption: string;
};

export type Role = {
  emoji: string;
  title: string;
  description: string;
  replaces: string;
};

export type MockRowTone = 'ok' | 'ai' | 'warn';

export type LandingContent = {
  dir: 'ltr' | 'rtl';
  nav: {
    sections: LandingSection[];
    login: string;
    requestAccess: string;
  };
  hero: {
    kicker: string;
    titleLines: [string, string];
    subtitle: string;
    requestAccess: string;
    seeHow: string;
    trust: string[];
  };
  /** The "system example" card: a static sketch of the daily dashboard. */
  mock: {
    title: string;
    sync: string;
    stats: { value: string; label: string }[];
    pipeTitle: string;
    rows: { tag: string; tone: MockRowTone; text: string }[];
    queue: { text: string; action: string }[];
  };
  pipelineStages: PipelineStage[];
  pillars: Pillar[];
  roles: {
    heading: SectionHeadingContent;
    items: Role[];
  };
  how: {
    heading: SectionHeadingContent;
    /** Rendered next to the pipeline: the whole thing runs live, not in batches. */
    note: string;
  };
  features: {
    heading: SectionHeadingContent;
    items: Feature[];
    chips: string[];
  };
  integrations: {
    heading: SectionHeadingContent;
    groups: IntegrationGroup[];
    andMore: string;
  };
  compliance: {
    heading: SectionHeadingContent;
    items: ComplianceItem[];
  };
  assistant: {
    heading: SectionHeadingContent;
    security: string;
    connectBefore: string;
    connectAfter: string;
    cardTitle: string;
    quote: string;
  };
  openSource: {
    heading: SectionHeadingContent;
    /** `id` picks the brand-icon row the card renders instead of prose links. */
    cards: { id: 'repo' | 'api' | 'agents'; title: string; description: string }[];
  };
  footer: {
    title: string;
    description: string;
    requestAccess: string;
    /** Short lead-in rendered next to The Guild's logo. */
    maintainedBy: string;
  };
};

const EN: LandingContent = {
  dir: 'ltr',
  nav: {
    sections: [
      { id: 'how-it-works', label: 'How it works' },
      { id: 'compliance', label: 'Israel-ready' },
      { id: 'features', label: 'Features' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'open-source', label: 'Open source' },
    ],
    login: 'Log in',
    requestAccess: 'Request access',
  },
  hero: {
    kicker: 'A complete end-to-end financial system for Israeli businesses',
    titleLines: ['Your books, on autopilot.', 'Your business, in control.'],
    subtitle:
      'Accounter pulls bank, card, crypto and payroll activity every day, reads invoices straight from your email, matches every transaction to its document, and writes the ledger entries — automatically. VAT, trial balance, P&L and annual reports — always ready. Your job is to manage, not to type.',
    requestAccess: 'Request access',
    seeHow: 'See how it works',
    trust: [],
  },
  mock: {
    title: 'Today',
    sync: 'Banks synced 06:40',
    stats: [
      { value: '₪1,451,230', label: 'Cash · 7 accounts' },
      { value: '+₪214,500', label: 'Net this month' },
      { value: '12', label: 'Need your review' },
    ],
    pipeTitle: 'Last 24 hours',
    rows: [
      { tag: 'SYNCED', tone: 'ok', text: '38 transactions from 4 banks & 3 cards' },
      { tag: 'OCR', tone: 'ai', text: '11 documents read from email' },
      { tag: 'MATCHED', tone: 'ok', text: '31 charges matched & ledgered automatically' },
      { tag: 'REVIEW', tone: 'warn', text: '4 low-confidence matches waiting for you' },
    ],
    queue: [
      { text: 'AWS invoice ↔ Isracard charge · 0.87', action: 'Approve' },
      { text: 'VAT July · 92% ready · 3 missing items', action: 'Close month' },
    ],
  },
  pipelineStages: [
    {
      icon: Landmark,
      label: 'Transactions',
      caption: 'banks · cards · crypto · securities · deposits · payroll',
    },
    { icon: Files, label: 'Documents', caption: 'invoices · receipts · email · drive' },
    { icon: Calculator, label: 'Ledger', caption: 'auto-matched, auto-generated, validated' },
    { icon: HandCoins, label: 'Tax files', caption: 'VAT · PCN874 · 6111 · uniform' },
    {
      icon: BarChartBig,
      label: 'P&L & annual reports',
      caption: 'FP&A · cash flow · management reports',
    },
  ],
  pillars: [
    {
      icon: ScanText,
      title: 'No typing errors',
      description:
        'Transactions and documents arrive on their own, are scanned automatically and paired with each other.',
    },
    {
      icon: Scale,
      title: 'A ledger that writes itself',
      description:
        'Double-entry ledger records generated for you automatically, regenerated on demand and checked for imbalance.',
    },
    {
      icon: FileCheck2,
      title: 'Files the authority accepts',
      description: 'VAT, 6111 and uniform-format exports straight out of your own books.',
    },
  ],
  roles: {
    heading: {
      eyebrow: 'One system — from bookkeeper to CEO',
      title: 'The work of a whole finance team',
      description:
        'Bookkeeper, accountant, CFO and CEO are users of the same living ledger — whether you are four, forty or one.',
    },
    items: [
      {
        emoji: '📚',
        title: 'Bookkeeper',
        description:
          'No more manual entry. Review a smart queue of exceptions — everything else is matched, categorized and posted automatically.',
        replaces: 'Replaces: hours of typing and chasing paper',
      },
      {
        emoji: '🧾',
        title: 'Accountant',
        description:
          'Approval workflows, ledger locking, monthly VAT with PCN874, annual reports and uniform-format export — audit-ready by design.',
        replaces: 'Replaces: month-end scrambles',
      },
      {
        emoji: '📊',
        title: 'CFO',
        description:
          'Live balances across every account and currency, P&L, FP&A views and cash-flow visibility — from real ledger data, not estimates.',
        replaces: 'Replaces: stale spreadsheets',
      },
      {
        emoji: '🎯',
        title: 'CEO',
        description:
          'Open the app, see three numbers updated in real time (instead of once a month), and make the few decisions that need you. Everything else already happened while you slept.',
        replaces: 'Replaces: flying blind',
      },
    ],
  },
  how: {
    heading: {
      eyebrow: 'How it works',
      title: 'From raw data to ready reports — in real time',
    },
    note: 'In real time, not once a month — every stage updates the moment new data arrives.',
  },
  features: {
    heading: {
      eyebrow: 'Features',
      title: 'Everything an Israeli company needs and more — in one place',
      description:
        "Accounter is not a reporting layer bolted onto someone else's books. The day-to-day work and the year-end filing happen against the same data.",
    },
    items: [
      {
        icon: Receipt,
        title: 'One view of every charge',
        description:
          'Transaction, document and ledger records tied together — with instant, advanced search.',
      },
      {
        icon: Puzzle,
        title: 'Smart matching',
        description:
          'Documents and transactions find each other, with anything uncertain flagged for review.',
      },
      {
        icon: Calculator,
        title: 'Monthly VAT, done',
        description: 'The PCN874 file assembles itself as documents arrive — validate and lock.',
      },
      {
        icon: ReceiptText,
        title: 'Real reports',
        description:
          'Trial balance, P&L, tax, depreciation — and a report builder you can save as a template.',
      },
      {
        icon: PlaneTakeoff,
        title: 'The weird stuff too',
        description:
          'Trips, salaries, dividends, deposits, securities and conversions — with automatic double-entry logic.',
      },
      {
        icon: Coins,
        title: 'Automatic foreign-currency and conversion support',
        description:
          'Official and bank rates side by side, year-end revaluations, crypto included.',
      },
      {
        icon: Handshake,
        title: 'Customers and suppliers',
        description:
          'Contracts, recurring billing and Green Invoice issuing — allocation numbers handled automatically.',
      },
      {
        icon: Building2,
        title: 'Multi-business',
        description: 'Several businesses in one workspace, each with its own ledger and filings.',
      },
    ],
    chips: [
      'AI document OCR',
      'Accountant approvals',
      'Ledger locking',
      'Ledger validation',
      'Annual audit workflow',
      'GraphQL API',
      'AI-agent ready (MCP)',
      'CSV & Excel export',
    ],
  },
  integrations: {
    heading: {
      eyebrow: 'Integrations',
      title: 'Your data arrives on its own',
      description:
        'Israeli banks and card issuers, crypto exchanges, invoicing platforms and payroll providers are read directly. What is left over, you forward by email.',
    },
    groups: [
      {
        icon: Landmark,
        title: 'Israeli banks and cards',
        items: [
          'Bank Hapoalim',
          'Bank Leumi',
          'Bank Discount',
          'Isracard',
          'American Express',
          'CAL',
          'Max',
        ],
        andMore: true,
      },
      {
        icon: Bitcoin,
        title: 'Crypto and trading',
        items: [
          'Kraken ledgers and trades',
          'Etherscan wallets and ERC-20 transfers',
          'Etana statement import',
          'CoinMarketCap pricing',
        ],
      },
      {
        icon: ReceiptText,
        title: 'Invoicing and accounting',
        items: ['Green Invoice (two-way)', 'Priority', 'Hashavshevet', 'Payper'],
        andMore: true,
      },
      {
        icon: BadgeDollarSign,
        title: 'Payroll and contractors',
        items: ['Deel contracts and invoices', 'Payroll file ingestion'],
      },
      {
        icon: Mail,
        title: 'Documents in',
        items: [
          'Per-tenant @accounter.tax inbox',
          'Google Drive',
          'AI reading of scanned invoices',
          'Cloud file storage',
        ],
      },
      {
        icon: Banknote,
        title: 'Rates and government',
        items: [
          'Bank of Israel exchange rates',
          'Israeli VAT portal (misim.gov.il)',
          'Foreign-currency revaluation',
        ],
      },
    ],
    andMore: '…and more',
  },
  compliance: {
    heading: {
      eyebrow: 'Israel-ready, to the letter',
      title: "Compliance is not an add-on. It's the foundation.",
      description: "Accounter speaks the Tax Authority's language.",
    },
    items: [
      {
        title: 'PCN874',
        description:
          'The periodic VAT report file, generated in the format the Tax Authority expects.',
      },
      {
        title: 'SHAAM 6111',
        description:
          'The annual tax report — generated, parsed and validated, with correct Hebrew encoding.',
      },
      {
        title: 'Uniform format (קובץ אחיד)',
        description:
          'INI.TXT and BKMVDATA.TXT per SHAAM spec 1.31, compatible with the leading accounting providers.',
      },
      {
        title: 'Monthly VAT',
        description:
          'A reviewable monthly VAT report built from the same documents, not a side workbook.',
      },
      {
        title: 'Allocation numbers (מספרי הקצאה)',
        description: 'Israel Invoices allocation numbers tracked on every document that needs one.',
      },
      {
        title: 'Corporate tax',
        description:
          'Corporate tax reporting plus a ruling-compliance report for businesses operating under a tax ruling.',
      },
      {
        title: 'Depreciation',
        description: 'Depreciation categories and schedules maintained across years.',
      },
      {
        title: 'Dividends and withholding',
        description: 'Dividend charges and withholding tax tracked on every charge that needs it.',
      },
      {
        title: 'Accountant approval',
        description: 'An explicit approval step so you and your accountant agree on what is final.',
      },
    ],
  },
  assistant: {
    heading: {
      eyebrow: 'AI connector',
      title: 'Ask Claude about your books',
      description:
        'Accounter ships a hosted MCP connector, so you can put questions to your own financial data in plain language instead of building a report to answer them.',
    },
    security:
      'Authenticated with your own account, and narrowed to the businesses you are a member of.',
    connectBefore: 'Connect it at ',
    connectAfter: ' once you have an account.',
    cardTitle: 'What it can look at',
    quote:
      '“Which clients still owe me for work invoiced last quarter, and what does that do to this month’s VAT?”',
  },
  openSource: {
    heading: {
      eyebrow: 'Open infrastructure',
      title: 'Software you can rely on for decades to come',
      description:
        'Your books should outlive any vendor. Accounter is fully open source — run it yourself, read every line, extend it, or let us run it for you. No lock-in, ever.',
    },
    cards: [
      {
        id: 'repo',
        title: 'Open source, truly',
        description:
          'The whole platform — ledger engine, bank scrapers, report generators, UI — open to the public. Not open-core. Not a trial.',
      },
      {
        id: 'api',
        title: 'API-first',
        description:
          'A full GraphQL API over everything you see — charges, documents, ledger, reports. Build your own views, automations and integrations.',
      },
      {
        id: 'agents',
        title: 'AI-agent integration',
        description:
          'A built-in MCP server lets Claude and other AI agents query your books safely — scoped, rate-limited and fully audit-logged.',
      },
    ],
  },
  footer: {
    title: 'Stop doing manual bookkeeping and step into the future of financial management',
    description:
      'Tell us about your business and we will set up a workspace for you and your accountant.',
    requestAccess: 'Request access',
    maintainedBy: 'Maintained by',
  },
};

const HE: LandingContent = {
  dir: 'rtl',
  nav: {
    sections: [
      { id: 'how-it-works', label: 'איך זה עובד' },
      { id: 'compliance', label: 'מותאם לישראל' },
      { id: 'features', label: 'יכולות' },
      { id: 'integrations', label: 'אינטגרציות' },
      { id: 'open-source', label: 'קוד פתוח' },
    ],
    login: 'התחברות',
    requestAccess: 'בקשת גישה',
  },
  hero: {
    kicker: 'מערכת פיננסית מלאה מקצה לקצה לעסקים ישראלים',
    titleLines: ['הנהלת החשבונות שלכם — על טייס אוטומטי.', 'העסק שלכם — בשליטה מלאה.'],
    subtitle:
      'Accounter מושך כל יום תנועות מהבנק, מהאשראי, מהקריפטו ומהשכר, קורא חשבוניות ישירות מהמייל, מצליב כל תנועה למסמך שלה, וכותב את הפקודות יומן — אוטומטית. מע״מ, מאזן בוחן, רווח והפסד ודוחות שנתיים — תמיד מוכנים. התפקיד שלכם הוא לנהל, לא להקליד.',
    requestAccess: 'בקשת גישה',
    seeHow: 'איך זה עובד',
    trust: [],
  },
  mock: {
    title: 'היום',
    sync: 'בנקים סונכרנו 06:40',
    stats: [
      { value: '₪1,451,230', label: 'מזומן · 7 חשבונות' },
      { value: '+₪214,500', label: 'נטו החודש' },
      { value: '12', label: 'ממתינים לאישורך' },
    ],
    pipeTitle: '24 השעות האחרונות',
    rows: [
      { tag: 'סונכרן', tone: 'ok', text: '38 תנועות מ־4 בנקים ו־3 כרטיסים' },
      { tag: 'OCR', tone: 'ai', text: '11 מסמכים נקראו מהמייל' },
      { tag: 'הוצלב', tone: 'ok', text: '31 תנועות הוצלבו ונרשמו ביומן אוטומטית' },
      { tag: 'לבדיקה', tone: 'warn', text: '4 התאמות בביטחון נמוך ממתינות לך' },
    ],
    queue: [
      { text: 'חשבונית AWS ↔ חיוב ישראכרט · 0.87', action: 'אישור' },
      { text: 'מע״מ יולי · 92% מוכן · 3 חוסרים', action: 'סגירת חודש' },
    ],
  },
  pipelineStages: [
    {
      icon: Landmark,
      label: 'תנועות',
      caption: 'בנקים · כרטיסים · קריפטו · ני״ע · פיקדונות · שכר',
    },
    { icon: Files, label: 'מסמכים', caption: 'חשבוניות · קבלות · מייל · דרייב' },
    { icon: Calculator, label: 'יומן', caption: 'מוצלב ונוצר אוטומטית, מאומת' },
    { icon: HandCoins, label: 'קבצי מס', caption: 'מע״מ · PCN874 · 6111 · קובץ אחיד' },
    {
      icon: BarChartBig,
      label: 'רווח והפסד ודוחות שנתיים',
      caption: 'FP&A · תזרים · דוחות מנהלים',
    },
  ],
  pillars: [
    {
      icon: ScanText,
      title: 'ללא טעויות הקלדה',
      description: 'התנועות והמסמכים מגיעים לבד, נסרקים אוטומטית ומוצמדים זה לזה.',
    },
    {
      icon: Scale,
      title: 'יומן שכותב את עצמו',
      description:
        'פקודות יומן בהנהלת חשבונות כפולה נוצרות עבורכם אוטומטית, נוצרות מחדש לפי דרישה ונבדקות לאיזון.',
    },
    {
      icon: FileCheck2,
      title: 'קבצים שהרשות מקבלת',
      description: 'מע״מ, 6111 וקובץ אחיד ישירות מהנהלת החשבונות שלכם.',
    },
  ],
  roles: {
    heading: {
      eyebrow: 'מערכת אחת — ממנהל/ת חשבונות ועד מנכ״ל/ית',
      title: 'העבודה של צוות כספים שלם',
      description:
        'מנהלת חשבונות, רואה חשבון, סמנכ״ל כספים ומנכ״ל — כולם משתמשים באותו יומן חי. בין אם אתם ארבעה, ארבעים או אחד.',
    },
    items: [
      {
        emoji: '📚',
        title: 'הנהלת חשבונות',
        description:
          'בלי הקלדות ידניות. סוקרים תור חכם של חריגים — כל השאר הוצלב, סווג ונרשם אוטומטית.',
        replaces: 'מחליף: שעות של הקלדה ורדיפה אחרי ניירת',
      },
      {
        emoji: '🧾',
        title: 'רואה חשבון',
        description:
          'תהליכי אישור, נעילת יומן, מע״מ חודשי עם PCN874, דוחות שנתיים וייצוא בקובץ אחיד — מוכן לביקורת מהיסוד.',
        replaces: 'מחליף: לחץ של סוף חודש',
      },
      {
        emoji: '📊',
        title: 'סמנכ״ל כספים',
        description:
          'יתרות חיות בכל חשבון ומטבע, רווח והפסד, FP&A ותזרים — מנתוני היומן האמיתיים, לא מהערכות.',
        replaces: 'מחליף: אקסלים לא מעודכנים',
      },
      {
        emoji: '🎯',
        title: 'מנכ״ל',
        description:
          'פותחים את המערכת, רואים שלושה מספרים מעודכנים בזמן אמת (במקום פעם בחודש) ועושים את ההחלטות הבודדות שצריכות אתכם. כל השאר כבר קרה בזמן שישנתם.',
        replaces: 'מחליף: טיסה על עיוור',
      },
    ],
  },
  how: {
    heading: {
      eyebrow: 'איך זה עובד',
      title: 'מנתונים גולמיים לדוחות מוכנים — בזמן אמת',
    },
    note: 'בזמן אמת, לא פעם בחודש — כל שלב מתעדכן ברגע שנתונים חדשים מגיעים.',
  },
  features: {
    heading: {
      eyebrow: 'יכולות',
      title: 'כל מה שחברה ישראלית צריכה ויותר — במקום אחד',
      description:
        'Accounter הוא לא שכבת דוחות שמורכבת על ספרים של מישהו אחר. העבודה היומיומית והדיווח של סוף השנה קורים מול אותם נתונים.',
    },
    items: [
      {
        icon: Receipt,
        title: 'תצוגה אחת לכל תנועה',
        description: 'תנועה, מסמך ופקודות יומן מחוברים יחד — עם חיפוש מיידי ומתקדם.',
      },
      {
        icon: Puzzle,
        title: 'הצלבה חכמה',
        description: 'מסמכים ותנועות מוצאים זה את זה, עם סימון לבדיקה לכל מה שלא בטוח.',
      },
      {
        icon: Calculator,
        title: 'מע״מ חודשי, סגור',
        description: 'קובץ PCN874 נבנה מעצמו כשהמסמכים מגיעים — ולידציה ונעילה.',
      },
      {
        icon: ReceiptText,
        title: 'דוחות אמיתיים',
        description: 'מאזן בוחן, רווח והפסד, מס, פחת — ובונה דוחות שאפשר לשמור כתבנית.',
      },
      {
        icon: PlaneTakeoff,
        title: 'גם הדברים המוזרים',
        description:
          'נסיעות, משכורות, דיבידנדים, פיקדונות, ניירות ערך והמרות — עם לוגיקת הנהלת חשבונות כפולה אוטומטית.',
      },
      {
        icon: Coins,
        title: 'תמיכה אוטומטית במטבע חוץ והמרות',
        description: 'שער יציג ושער בנק זה לצד זה, שערוכי סוף שנה, כולל קריפטו.',
      },
      {
        icon: Handshake,
        title: 'לקוחות וספקים',
        description: 'חוזים, חיוב חוזר והפקה בחשבונית ירוקה — מספרי הקצאה מטופלים אוטומטית.',
      },
      {
        icon: Building2,
        title: 'ריבוי עסקים',
        description: 'כמה עסקים בסביבה אחת — לכל אחד יומן ודיווחים משלו.',
      },
    ],
    chips: [
      'OCR מסמכים ב־AI',
      'אישורי רואה חשבון',
      'נעילת יומן',
      'ולידציית יומן',
      'תהליך ביקורת שנתי',
      'GraphQL API',
      'מוכן לסוכני AI (MCP)',
      'ייצוא CSV ואקסל',
    ],
  },
  integrations: {
    heading: {
      eyebrow: 'אינטגרציות',
      title: 'הנתונים שלכם מגיעים לבד',
      description:
        'בנקים וחברות אשראי ישראליים, בורסות קריפטו, פלטפורמות חשבוניות וספקי שכר נקראים ישירות. את מה שנשאר — מעבירים במייל.',
    },
    groups: [
      {
        icon: Landmark,
        title: 'בנקים וכרטיסים ישראליים',
        items: [
          'בנק הפועלים',
          'בנק לאומי',
          'בנק דיסקונט',
          'ישראכרט',
          'אמריקן אקספרס',
          'כאל',
          'מקס',
        ],
        andMore: true,
      },
      {
        icon: Bitcoin,
        title: 'קריפטו ומסחר',
        items: [
          'יומנים ועסקאות מ־Kraken',
          'ארנקים והעברות ERC-20 מ־Etherscan',
          'ייבוא דפי חשבון מ־Etana',
          'תמחור CoinMarketCap',
        ],
      },
      {
        icon: ReceiptText,
        title: 'חשבוניות והנהלת חשבונות',
        items: ['חשבונית ירוקה (דו־כיווני)', 'פריוריטי', 'חשבשבת', 'פייפרלס'],
        andMore: true,
      },
      {
        icon: BadgeDollarSign,
        title: 'שכר וקבלנים',
        items: ['חוזים וחשבוניות מ־Deel', 'קליטת קבצי שכר'],
      },
      {
        icon: Mail,
        title: 'מסמכים נכנסים',
        items: [
          'תיבת @accounter.tax ייעודית לכל עסק',
          'Google Drive',
          'קריאת חשבוניות סרוקות עם AI',
          'אחסון קבצים בענן',
        ],
      },
      {
        icon: Banknote,
        title: 'שערים וממשלה',
        items: ['שערי החליפין של בנק ישראל', 'פורטל מע״מ (misim.gov.il)', 'שערוך מטבעות חוץ'],
      },
    ],
    andMore: '…ועוד',
  },
  compliance: {
    heading: {
      eyebrow: 'מותאם לישראל, עד רמת הפסיק',
      title: 'רגולציה היא לא תוסף. היא הבסיס.',
      description: 'Accounter מדבר את שפת רשות המסים.',
    },
    items: [
      {
        title: 'PCN874',
        description: 'קובץ הדיווח התקופתי למע״מ, נוצר בפורמט שרשות המסים מצפה לו.',
      },
      {
        title: 'טופס 6111',
        description: 'הדוח השנתי — נוצר, מפוענח ומאומת, עם קידוד עברית תקין.',
      },
      {
        title: 'קובץ אחיד',
        description: 'INI.TXT ו־BKMVDATA.TXT לפי מפרט שע״ם 1.31, תואם לספקי התוכנה המובילים.',
      },
      {
        title: 'מע״מ חודשי',
        description: 'דוח מע״מ חודשי שניתן לסקירה, שנבנה מאותם מסמכים — לא מגיליון צדדי.',
      },
      {
        title: 'מספרי הקצאה',
        description: 'מספרי הקצאה של חשבוניות ישראל במעקב על כל מסמך שדורש אחד.',
      },
      {
        title: 'מס חברות',
        description: 'דיווחי מס חברות, ובנוסף דוח עמידה ברולינג לעסקים שפועלים תחת החלטת מיסוי.',
      },
      {
        title: 'פחת',
        description: 'קטגוריות ולוחות פחת מנוהלים לאורך שנים.',
      },
      {
        title: 'דיבידנדים וניכוי במקור',
        description: 'תנועות דיבידנד וניכוי מס במקור במעקב על כל תנועה שדורשת זאת.',
      },
      {
        title: 'אישור רואה חשבון',
        description: 'שלב אישור מפורש, כדי שאתם ורואה החשבון שלכם תסכימו מה סופי.',
      },
    ],
  },
  assistant: {
    heading: {
      eyebrow: 'מחבר AI',
      title: 'שאלו את Claude על הנהלת החשבונות שלכם',
      description:
        'Accounter מגיע עם מחבר MCP מנוהל, כך שאפשר לשאול שאלות על הנתונים הפיננסיים שלכם בשפה חופשית — במקום לבנות דוח כדי לענות עליהן.',
    },
    security: 'מאומת עם החשבון שלכם, ומצומצם לעסקים שאתם חברים בהם.',
    connectBefore: 'חברו אותו ב־',
    connectAfter: ' ברגע שיש לכם חשבון.',
    cardTitle: 'מה הוא יכול לראות',
    quote:
      '״אילו לקוחות עדיין חייבים לי על עבודה שחויבה ברבעון שעבר, ומה זה עושה למע״מ של החודש הזה?״',
  },
  openSource: {
    heading: {
      eyebrow: 'תשתית פתוחה',
      title: 'תוכנה שאפשר לסמוך עליה עשרות שנים קדימה',
      description:
        'הנהלת החשבונות שלכם צריכה לשרוד כל ספק. Accounter הוא קוד פתוח מלא — הריצו בעצמכם, קראו כל שורה, הרחיבו, או תנו לנו להריץ בשבילכם. בלי נעילה, לעולם.',
    },
    cards: [
      {
        id: 'repo',
        title: 'קוד פתוח, באמת',
        description:
          'כל הפלטפורמה — מנוע היומן, סקרייפרים לבנקים, מחוללי דוחות, ממשק — פתוחים לציבור. לא open-core. לא גרסת ניסיון.',
      },
      {
        id: 'api',
        title: 'API קודם כול',
        description:
          'GraphQL API מלא על כל מה שרואים — תנועות, מסמכים, יומן, דוחות. בנו תצוגות, אוטומציות ואינטגרציות משלכם.',
      },
      {
        id: 'agents',
        title: 'התממשקות לסוכני AI',
        description:
          'שרת MCP מובנה מאפשר ל־Claude וסוכני AI אחרים לתשאל את הנהלת החשבונות בבטחה — עם הרשאות, הגבלות קצב ותיעוד מלא.',
      },
    ],
  },
  footer: {
    title: 'תפסיקו לעשות הנהלת חשבונות ידנית ותתקדמו לעתיד של הניהול הכלכלי',
    description: 'ספרו לנו על העסק שלכם ונקים סביבת עבודה לכם ולרואה החשבון שלכם.',
    requestAccess: 'בקשת גישה',
    maintainedBy: 'מנוהל על ידי',
  },
};

export const CONTENT: Record<LandingLang, LandingContent> = { en: EN, he: HE };
