import {
  ArrowLeftRight,
  BadgeDollarSign,
  Banknote,
  BarChartBig,
  Bitcoin,
  BookOpenCheck,
  Calculator,
  CandlestickChart,
  FileCheck2,
  FilePen,
  Files,
  HandCoins,
  Landmark,
  ListChecks,
  Mail,
  PlaneTakeoff,
  Puzzle,
  Receipt,
  ReceiptText,
  Scale,
  ScanText,
  Tags,
  type LucideIcon,
} from 'lucide-react';

/**
 * Copy for the public landing page, kept out of the JSX so wording can be edited
 * without touching layout. Nothing here is fetched — the page is static by design.
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

export type LandingSection = {
  id: string;
  label: string;
};

export const NAV_SECTIONS: LandingSection[] = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'compliance', label: 'Compliance' },
];

export type Step = {
  title: string;
  description: string;
};

export const STEPS: Step[] = [
  {
    title: 'Connect',
    description:
      'Bank accounts, credit cards, crypto exchanges and payroll providers are pulled in automatically. Invoices arrive by forwarding them to your own @accounter.tax inbox, from Google Drive, or straight from Green Invoice.',
  },
  {
    title: 'Match',
    description:
      'Every transaction is paired with the document that explains it. Scanned paperwork is read by AI, the counterparty business is identified, and confident pairs are matched for you — the rest land on a short review queue.',
  },
  {
    title: 'Post',
    description:
      'Matched charges generate double-entry ledger records with the right tax category, sort code, VAT split and exchange rate. Records are re-derivable, validated for imbalance, and lockable once a period is closed.',
  },
  {
    title: 'File',
    description:
      'Monthly VAT, PCN874, SHAAM 6111 and the full uniform-format export (INI.TXT + BKMVDATA.TXT) are generated from the same ledger you have been reviewing all year — not rebuilt from scratch each spring.',
  },
];

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const FEATURES: Feature[] = [
  {
    icon: Receipt,
    title: 'Charges',
    description:
      'The unit that ties a transaction, its supporting document and its ledger records together. Filter, search and drill into every one of them.',
  },
  {
    icon: Puzzle,
    title: 'Charge matching',
    description:
      'Scored, assisted matching between transactions and documents, with a dedicated review screen for everything the matcher was not sure about.',
  },
  {
    icon: BookOpenCheck,
    title: 'Ledger validation',
    description:
      'Surfaces charges whose ledger would change if regenerated, plus businesses whose balance does not add up — before an accountant finds them.',
  },
  {
    icon: ReceiptText,
    title: 'Reports',
    description:
      'Trial balance, profit and loss, tax, depreciation, annual revenue, yearly ledger, transaction balance — and a dynamic report builder you can save as a template.',
  },
  {
    icon: Files,
    title: 'Documents',
    description:
      'Invoices, receipts, credit invoices and proformas in one place, linked to the charges they justify and stored with the original file.',
  },
  {
    icon: FilePen,
    title: 'Issue invoices',
    description:
      'Issue single or recurring documents through Green Invoice, preview the PDF, and email it to the client without leaving Accounter.',
  },
  {
    icon: PlaneTakeoff,
    title: 'Business trips',
    description:
      'Flights, accommodation, car rental, per-attendee expenses and employee reimbursements, with the Israeli travel and subsistence tax variables applied.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Salaries',
    description:
      'Payroll charges with employees, pension and study funds, and recovery pay reconciled against what actually left the bank.',
  },
  {
    icon: CandlestickChart,
    title: 'Securities',
    description:
      'Foreign securities holdings and executions tracked alongside everything else, valued in your reporting currency.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Business ledger',
    description:
      'A running ledger per counterparty, plus contracts, bank deposits, tax categories and the sort codes behind your chart of accounts.',
  },
  {
    icon: ListChecks,
    title: 'Annual audit workflow',
    description:
      'A guided year-end pass — opening balances through to the saved report template — so closing the books is a checklist, not an archaeology project.',
  },
  {
    icon: BarChartBig,
    title: 'Charts and tags',
    description:
      'Monthly income and expense charts, and a tagging system for slicing activity the way your business actually thinks about it.',
  },
];

export type IntegrationGroup = {
  icon: LucideIcon;
  title: string;
  items: string[];
};

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    icon: Landmark,
    title: 'Israeli banks and cards',
    items: [
      'Bank Hapoalim',
      'Bank Discount',
      'Bank Otsar Ha-Hayal',
      'Isracard',
      'American Express',
      'CAL',
      'Max',
    ],
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
    items: ['Green Invoice (two-way)', 'Hashavshevet', 'Payper'],
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
      'Cloudinary file storage',
    ],
  },
  {
    icon: Banknote,
    title: 'Rates and government',
    items: [
      'Bank of Israel exchange rates',
      'Israeli VAT portal (misim.gov.il)',
      'Multi-currency revaluation',
    ],
  },
];

export type ComplianceItem = {
  title: string;
  description: string;
};

export const COMPLIANCE_ITEMS: ComplianceItem[] = [
  {
    title: 'PCN874',
    description: 'The periodic VAT report file, generated in the format the Tax Authority expects.',
  },
  {
    title: 'SHAAM 6111',
    description:
      'The annual tax report — generated, parsed and validated, with correct Hebrew encoding.',
  },
  {
    title: 'Uniform format (מבנה אחיד)',
    description:
      'INI.TXT and BKMVDATA.TXT per SHAAM spec 1.31, down to field widths, padding and line endings.',
  },
  {
    title: 'Monthly VAT',
    description: 'A reviewable monthly VAT report built from the same ledger, not a side workbook.',
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
];

export type Pillar = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const HERO_PILLARS: Pillar[] = [
  {
    icon: ScanText,
    title: 'Nothing typed twice',
    description: 'Transactions and documents arrive on their own and find each other.',
  },
  {
    icon: Scale,
    title: 'A ledger that holds',
    description: 'Double-entry records, regenerated on demand and checked for imbalance.',
  },
  {
    icon: FileCheck2,
    title: 'Files the authority accepts',
    description: 'VAT, 6111 and uniform-format exports straight out of your own books.',
  },
];

export type PipelineStage = {
  icon: LucideIcon;
  label: string;
  caption: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  { icon: Landmark, label: 'Transactions', caption: 'banks · cards · crypto · payroll' },
  { icon: Files, label: 'Documents', caption: 'invoices · receipts · email · drive' },
  { icon: Receipt, label: 'Charge', caption: 'matched and categorised' },
  { icon: Calculator, label: 'Ledger', caption: 'double-entry, validated' },
  { icon: HandCoins, label: 'Tax files', caption: 'VAT · PCN874 · 6111 · uniform' },
];

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

export const FOOTER_TAGS: { icon: LucideIcon; label: string }[] = [
  { icon: Tags, label: 'Multi-business by default' },
  { icon: Calculator, label: 'Built with accountants in the loop' },
];
