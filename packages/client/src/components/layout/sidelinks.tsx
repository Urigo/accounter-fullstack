import type { JSX } from 'react';
import {
  ArrowDown01,
  ArrowLeftRight,
  BadgeDollarSign,
  BarChartBig,
  Book,
  BookOpenCheck,
  Calculator,
  ChartColumnDecreasing,
  ChartNoAxesCombined,
  CheckCheck,
  Download,
  Factory,
  FilePen,
  Files,
  HandCoins,
  IdCard,
  ParkingMeter,
  PlaneTakeoff,
  Puzzle,
  Receipt,
  ReceiptText,
  RectangleEllipsis,
  Rows4,
  Scale,
  Tags,
} from 'lucide-react';
import { ROUTES } from '../../router/routes.js';

export interface NavLink {
  title: string;
  label?: string;
  href?: string;
  icon: JSX.Element;
  action?: () => void;
}

export interface SideLink extends NavLink {
  sub?: NavLink[];
}

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
        href: ROUTES.CHARGES.ALL,
        icon: <Receipt size={18} />,
      },
      {
        title: 'Missing Info Charges',
        label: '',
        href: ROUTES.CHARGES.MISSING_INFO,
        icon: <RectangleEllipsis size={18} />,
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
    title: 'Reports',
    label: '',
    href: '',
    icon: <ReceiptText size={18} />,
    sub: [
      {
        title: 'VAT Monthly Report',
        label: '',
        href: ROUTES.REPORTS.VAT_MONTHLY,
        icon: <Receipt size={18} />,
      },
      {
        title: 'Trial Balance Report',
        label: '',
        href: ROUTES.REPORTS.TRIAL_BALANCE,
        icon: <Scale size={18} />,
      },
      {
        title: 'Conto Report',
        label: '',
        href: ROUTES.REPORTS.CONTO,
        icon: <Puzzle size={18} />,
      },
      {
        title: 'Profit and Loss Report',
        label: '',
        href: ROUTES.REPORTS.PROFIT_AND_LOSS(),
        icon: <HandCoins size={18} />,
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
        icon: <ParkingMeter size={18} />,
      },
      {
        title: 'Depreciation Report',
        label: '',
        href: ROUTES.REPORTS.DEPRECIATION,
        icon: <ChartColumnDecreasing size={18} />,
      },
      {
        title: 'Shaam 6111 Report',
        label: '',
        href: ROUTES.REPORTS.SHAAM_6111,
        icon: <HandCoins size={18} />,
      },
      {
        title: 'Accountant Approvals',
        label: '',
        href: ROUTES.ACCOUNTANT_APPROVALS,
        icon: <Calculator size={18} />,
      },
      {
        title: 'Yearly Ledger Report',
        label: '',
        href: ROUTES.REPORTS.YEARLY_LEDGER,
        icon: <Rows4 size={18} />,
      },
      {
        title: 'Transactions Balance',
        label: '',
        href: ROUTES.REPORTS.BALANCE,
        icon: <ChartNoAxesCombined size={18} />,
      },
      {
        title: 'Validate Reports',
        label: '',
        href: ROUTES.REPORTS.VALIDATE_REPORTS,
        icon: <CheckCheck size={18} />,
      },
      {
        title: 'Generate Uniform Files',
        label: '',
        icon: <Download size={18} />,
      },
    ],
  },
  {
    title: 'Financial Entities',
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
        title: 'Business Transactions',
        label: '',
        href: ROUTES.BUSINESSES.TRANSACTIONS,
        icon: <ArrowLeftRight size={18} />,
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
    ],
  },
  {
    title: 'Documents',
    label: '',
    href: '',
    icon: <Files size={18} />,
    sub: [
      {
        href: ROUTES.DOCUMENTS.ALL,
        title: 'All Documents',
        label: '',
        icon: <Files size={18} />,
      },
      {
        title: 'Issue Documents',
        label: '',
        href: ROUTES.DOCUMENTS.ISSUE_DOCUMENTS,
        icon: <FilePen size={18} />,
      },
      {
        title: 'Issue Document',
        label: '',
        href: ROUTES.DOCUMENTS.ISSUE_DOCUMENT,
        icon: <FilePen size={18} />,
      },
    ],
  },
  {
    href: ROUTES.BUSINESS_TRIPS.ALL,
    title: 'Business Trips',
    label: '',
    icon: <PlaneTakeoff size={18} />,
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
        icon: <BarChartBig size={18} />,
      },
    ],
  },
  {
    href: ROUTES.SALARIES,
    title: 'Salaries',
    label: '',
    icon: <BadgeDollarSign size={18} />,
  },
  {
    href: ROUTES.TAGS,
    title: 'Tags',
    label: '',
    icon: <Tags size={18} />,
  },
];
