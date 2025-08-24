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
  ListChecks,
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
        href: '/charges',
        icon: <Receipt size={18} />,
      },
      {
        title: 'Missing Info Charges',
        label: '',
        href: '/missing-info-charges',
        icon: <RectangleEllipsis size={18} />,
      },
      {
        title: 'Ledger Validation',
        label: '',
        href: '/charges-ledger-validation',
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
        href: '/reports/vat-monthly',
        icon: <Receipt size={18} />,
      },
      {
        title: 'Trial Balance Report',
        label: '',
        href: '/reports/trial-balance',
        icon: <Scale size={18} />,
      },
      {
        title: 'Conto Report',
        label: '',
        href: '/reports/conto',
        icon: <Puzzle size={18} />,
      },
      {
        title: 'Profit and Loss Report',
        label: '',
        href: '/reports/profit-and-loss',
        icon: <HandCoins size={18} />,
      },
      {
        title: 'Tax Report',
        label: '',
        href: '/reports/tax',
        icon: <ParkingMeter size={18} />,
      },
      {
        title: 'Corporate Tax Ruling Compliance Report',
        label: '',
        href: '/reports/corporate-tax-ruling-compliance',
        icon: <ParkingMeter size={18} />,
      },
      {
        title: 'Depreciation Report',
        label: '',
        href: '/reports/depreciation',
        icon: <ChartColumnDecreasing size={18} />,
      },
      {
        title: 'Shaam 6111 Report',
        label: '',
        href: '/reports/shaam6111',
        icon: <HandCoins size={18} />,
      },
      {
        title: 'Accountant Approvals',
        label: '',
        href: '/accountant-approvals',
        icon: <Calculator size={18} />,
      },
      {
        title: 'Yearly Ledger Report',
        label: '',
        href: '/reports/yearly-ledger',
        icon: <Rows4 size={18} />,
      },
      {
        title: 'Transactions Balance',
        label: '',
        href: '/reports/balance',
        icon: <ChartNoAxesCombined size={18} />,
      },
      {
        title: 'Validate Reports',
        label: '',
        href: '/reports/validate-reports',
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
        href: '/businesses',
        icon: <Factory size={18} />,
      },
      {
        title: 'Business Transactions',
        label: '',
        href: '/business-transactions',
        icon: <ArrowLeftRight size={18} />,
      },
      {
        title: 'Tax Categories',
        label: '',
        href: '/tax-categories',
        icon: <ArrowDown01 size={18} />,
      },
      {
        title: 'Sort Codes',
        label: '',
        href: '/sort-codes',
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
        href: '/documents',
        title: 'All Documents',
        label: '',
        icon: <Files size={18} />,
      },
      {
        title: 'Issue Documents',
        label: '',
        href: '/documents/issue-documents',
        icon: <FilePen size={18} />,
      },
      {
        title: 'Issue Document',
        label: '',
        href: '/documents/issue-document',
        icon: <FilePen size={18} />,
      },
    ],
  },
  {
    href: '/business-trips',
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
        href: '/charts/',
        icon: <BarChartBig size={18} />,
      },
      {
        title: 'Monthly Income/Expense',
        label: '',
        href: '/charts/monthly-income-expense',
        icon: <BarChartBig size={18} />,
      },
    ],
  },
  {
    title: 'Workflows',
    label: '',
    href: '',
    icon: <ListChecks size={18} />,
    sub: [
      {
        title: 'Year-end audit',
        label: '',
        href: '/workflows/annual-audit',
        icon: <ListChecks size={18} />,
      },
    ],
  },
  {
    href: '/salaries',
    title: 'Salaries',
    label: '',
    icon: <BadgeDollarSign size={18} />,
  },
  {
    href: '/tags',
    title: 'Tags',
    label: '',
    icon: <Tags size={18} />,
  },
];
