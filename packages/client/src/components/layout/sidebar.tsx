import { useState } from 'react';
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BarChartBig,
  BookOpenCheck,
  ChevronLeft,
  Files,
  HandCoins,
  Handshake,
  ParkingMeter,
  PlaneTakeoff,
  Receipt,
  ReceiptText,
  Scale,
  Tags,
} from 'lucide-react';
import { useSidebar } from '../../hooks/use-sidebar';
import { cn } from '../../lib/utils';
import { DashboardNav } from './dashboard-nav';

export interface NavItem {
  label: string;
  to: string;
  icon: string | React.ReactNode;
}

export const navItems: NavItem[] = [
  {
    label: 'All Charges',
    to: '/charges',
    icon: <ReceiptText />,
  },
  {
    label: 'Ledger Validation',
    to: '/charges-ledger-validation',
    icon: <BookOpenCheck />,
  },
  {
    label: 'Documents',
    to: '/documents',
    icon: <Files />,
  },
  {
    label: 'Businesses',
    to: '/businesses',
    icon: <Handshake />,
  },
  {
    label: 'Business Transactions',
    to: '/business-transactions',
    icon: <ArrowLeftRight />,
  },
  {
    label: 'Business Trips',
    to: '/business-trips',
    icon: <PlaneTakeoff />,
  },
  {
    label: 'Trial Balance Report',
    to: '/reports/trial-balance',
    icon: <Scale />,
  },
  {
    label: 'VAT Monthly Report',
    to: '/reports/vat-monthly',
    icon: <Receipt />,
  },
  {
    label: 'Profit and Loss Report',
    to: '/reports/profit-and-loss',
    icon: <HandCoins />,
  },
  {
    label: 'Tax Report',
    to: '/reports/tax',
    icon: <ParkingMeter />,
  },
  {
    label: 'Charts',
    to: '/charts',
    icon: <BarChartBig />,
  },
  {
    label: 'Tags',
    to: '/tags',
    icon: <Tags />,
  },
  {
    label: 'Salaries',
    to: '/salaries',
    icon: <BadgeDollarSign />,
  },
];

type SidebarProps = {
  className?: string;
};

export function Sidebar({ className }: SidebarProps): JSX.Element {
  const { isMinimized, toggle } = useSidebar();
  const [status, setStatus] = useState(false);

  const handleToggle = (): void => {
    setStatus(true);
    toggle();
    setTimeout(() => setStatus(false), 300);
  };

  return (
    <nav
      className={cn(
        'relative hidden h-screen flex-none border-r z-10 pt-10 md:block',
        status && 'duration-300',
        isMinimized ? 'w-[72px]' : 'w-[240px]',
        className,
      )}
    >
      <ChevronLeft
        className={cn(
          'absolute -right-3 top-20 cursor-pointer bg-gray-100 rounded-full border text-3xl text-foreground',
          isMinimized && 'rotate-180',
        )}
        onClick={handleToggle}
      />
      <div className="space-y-4 py-4 flex flex-col items-center">
        <div className="px-3 py-2">
          <div className="mt-3 space-y-1">
            <DashboardNav items={navItems} />
          </div>
        </div>
      </div>
    </nav>
  );
}
