import type { JSX } from 'react';
import {
  ArrowDown01,
  ArrowLeftRight,
  BadgeDollarSign,
  BarChartBig,
  Book,
  BookOpenCheck,
  Briefcase,
  Calculator,
  CandlestickChart,
  ChartColumnDecreasing,
  ChartLine,
  ChartNoAxesCombined,
  CheckCheck,
  Download,
  Factory,
  FileChartColumn,
  FilePen,
  Files,
  FileSpreadsheet,
  FileStack,
  FileText,
  Gavel,
  HandCoins,
  IdCard,
  Landmark,
  ListChecks,
  ParkingMeter,
  Percent,
  PiggyBank,
  PlaneTakeoff,
  Puzzle,
  Receipt,
  ReceiptText,
  RectangleEllipsis,
  Rows4,
  Scale,
  Signature,
  SlidersHorizontal,
  Tags,
  TrendingUp,
} from 'lucide-react';
import { ROUTES } from '../../router/routes.js';

/** Identifies a link that opens a modal instead of navigating; the sidebars attach its `action` */
export type NavActionId = 'uniform-format-files';

export interface NavLink {
  title: string;
  label?: string;
  href?: string;
  icon: JSX.Element;
  action?: () => void;
  actionId?: NavActionId;
}

export interface SideLink extends NavLink {
  sub?: NavLink[];
}

/*
 * Groups are ordered by how often they are used: daily bookkeeping (charges, documents,
 * operations), then periodic filings and reports, then year-end work and master data.
 */
export const sidelinks: SideLink[] = [
  {
    title: 'Charges',
    label: '',
    href: '',
    icon: <Receipt size={18} />,
    sub: [
      {
        title: 'All Charges',
        label: '',
        href: ROUTES.CHARGES.ALL(),
        icon: <Receipt size={18} />,
      },
      {
        title: 'Missing Info Charges',
        label: '',
        href: ROUTES.CHARGES.MISSING_INFO,
        icon: <RectangleEllipsis size={18} />,
      },
      {
        title: 'Charge Matching',
        label: '',
        href: ROUTES.CHARGES.MATCHING,
        icon: <Puzzle size={18} />,
      },
      {
        title: 'Ledger Validation',
        label: '',
        href: ROUTES.CHARGES.LEDGER_VALIDATION,
        icon: <BookOpenCheck size={18} />,
      },
    ],
  },
  {
    title: 'Documents',
    label: '',
    href: '',
    icon: <Files size={18} />,
    sub: [
      {
        title: 'All Documents',
        label: '',
        href: ROUTES.DOCUMENTS.ALL,
        icon: <Files size={18} />,
      },
      {
        title: 'Issue Document',
        label: '',
        href: ROUTES.DOCUMENTS.ISSUE_DOCUMENT,
        icon: <FilePen size={18} />,
      },
      {
        title: 'Issue Monthly Documents',
        label: '',
        href: ROUTES.DOCUMENTS.ISSUE_DOCUMENTS,
        icon: <FileStack size={18} />,
      },
    ],
  },
  {
    title: 'Operations',
    label: '',
    href: '',
    icon: <Briefcase size={18} />,
    sub: [
      {
        title: 'Bank Deposits',
        label: '',
        href: ROUTES.BANK_DEPOSITS.ALL,
        icon: <PiggyBank size={18} />,
      },
      {
        title: 'Salaries',
        label: '',
        href: ROUTES.SALARIES,
        icon: <BadgeDollarSign size={18} />,
      },
      {
        title: 'Business Trips',
        label: '',
        href: ROUTES.BUSINESS_TRIPS.ALL,
        icon: <PlaneTakeoff size={18} />,
      },
      {
        title: 'Securities',
        label: '',
        href: ROUTES.SECURITIES,
        icon: <CandlestickChart size={18} />,
      },
    ],
  },
  {
    title: 'Tax & Filings',
    label: '',
    href: '',
    icon: <Landmark size={18} />,
    sub: [
      {
        title: 'VAT Monthly Report',
        label: '',
        href: ROUTES.REPORTS.VAT_MONTHLY,
        icon: <FileSpreadsheet size={18} />,
      },
      {
        title: 'Tax Report',
        label: '',
        href: ROUTES.REPORTS.TAX(),
        icon: <ParkingMeter size={18} />,
      },
      {
        title: 'Corporate Tax Ruling Compliance Report',
        label: '',
        href: ROUTES.REPORTS.CORPORATE_TAX_RULING_COMPLIANCE(),
        icon: <Gavel size={18} />,
      },
      {
        title: 'Shaam 6111 Report',
        label: '',
        href: ROUTES.REPORTS.SHAAM_6111,
        icon: <FileText size={18} />,
      },
      {
        title: 'Securities Semi-Annual Report',
        label: '',
        href: ROUTES.REPORTS.SECURITIES_SEMI_ANNUAL,
        icon: <FileChartColumn size={18} />,
      },
      {
        title: 'Generate Uniform Files',
        label: '',
        icon: <Download size={18} />,
        actionId: 'uniform-format-files',
      },
      {
        title: 'CPI Linkage Calculator',
        label: '',
        href: ROUTES.REPORTS.CPI_CALCULATOR,
        icon: <Percent size={18} />,
      },
    ],
  },
  {
    title: 'Reports',
    label: '',
    href: '',
    icon: <ReceiptText size={18} />,
    sub: [
      {
        title: 'Profit and Loss Report',
        label: '',
        href: ROUTES.REPORTS.PROFIT_AND_LOSS(),
        icon: <HandCoins size={18} />,
      },
      {
        title: 'Trial Balance Report',
        label: '',
        href: ROUTES.REPORTS.TRIAL_BALANCE(),
        icon: <Scale size={18} />,
      },
      {
        title: 'Yearly Ledger Report',
        label: '',
        href: ROUTES.REPORTS.YEARLY_LEDGER,
        icon: <Rows4 size={18} />,
      },
      {
        title: 'Business Ledger',
        label: '',
        href: ROUTES.BUSINESSES.LEDGER,
        icon: <ArrowLeftRight size={18} />,
      },
      {
        title: 'Transactions Balance',
        label: '',
        href: ROUTES.REPORTS.BALANCE,
        icon: <ChartNoAxesCombined size={18} />,
      },
      {
        title: 'Depreciation Report',
        label: '',
        href: ROUTES.REPORTS.DEPRECIATION(),
        icon: <ChartColumnDecreasing size={18} />,
      },
      {
        title: 'Annual Revenue Report',
        label: '',
        href: ROUTES.REPORTS.ANNUAL_REVENUE,
        icon: <TrendingUp size={18} />,
      },
      {
        title: 'Dynamic Report',
        label: '',
        href: ROUTES.REPORTS.DYNAMIC_REPORT(),
        icon: <SlidersHorizontal size={18} />,
      },
    ],
  },
  {
    title: 'Charts',
    label: '',
    href: '',
    icon: <BarChartBig size={18} />,
    sub: [
      {
        title: 'Main',
        label: '',
        href: ROUTES.CHARTS.MAIN,
        icon: <BarChartBig size={18} />,
      },
      {
        title: 'Monthly Income/Expense',
        label: '',
        href: ROUTES.CHARTS.MONTHLY_INCOME_EXPENSE,
        icon: <ChartLine size={18} />,
      },
    ],
  },
  {
    title: 'Year-End Closing',
    label: '',
    href: '',
    icon: <ListChecks size={18} />,
    sub: [
      {
        title: 'Annual Audit',
        label: '',
        href: ROUTES.WORKFLOWS.ANNUAL_AUDIT(),
        icon: <ListChecks size={18} />,
      },
      {
        title: 'Validate Reports',
        label: '',
        href: ROUTES.REPORTS.VALIDATE_REPORTS,
        icon: <CheckCheck size={18} />,
      },
      {
        title: 'Accountant Approvals',
        label: '',
        href: ROUTES.ACCOUNTANT_APPROVALS,
        icon: <Calculator size={18} />,
      },
    ],
  },
  {
    title: 'Master Data',
    label: '',
    href: '',
    icon: <IdCard size={18} />,
    sub: [
      {
        title: 'Businesses',
        label: '',
        href: ROUTES.BUSINESSES.ALL,
        icon: <Factory size={18} />,
      },
      {
        title: 'Contracts',
        label: '',
        href: ROUTES.BUSINESSES.CONTRACTS,
        icon: <Signature size={18} />,
      },
      {
        title: 'Tax Categories',
        label: '',
        href: ROUTES.TAX_CATEGORIES,
        icon: <ArrowDown01 size={18} />,
      },
      {
        title: 'Sort Codes',
        label: '',
        href: ROUTES.SORT_CODES,
        icon: <Book size={18} />,
      },
      {
        title: 'Tags',
        label: '',
        href: ROUTES.TAGS,
        icon: <Tags size={18} />,
      },
    ],
  },
];
