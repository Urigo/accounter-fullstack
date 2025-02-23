import type { JSX } from 'react';
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BarChartBig,
  Book,
  BookOpenCheck,
  Calculator,
  Files,
  HandCoins,
  Handshake,
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
  href: string;
  icon: JSX.Element;
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
    ],
  },
  {
    title: 'Financial Entities',
    label: '',
    href: '',
    icon: <Handshake size={18} />,
    sub: [
      {
        title: 'Businesses',
        label: '',
        href: '/businesses',
        icon: <Handshake size={18} />,
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
        icon: <Book size={18} />,
      },
    ],
  },
  {
    href: '/documents',
    title: 'Documents',
    label: '',
    icon: <Files size={18} />,
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
