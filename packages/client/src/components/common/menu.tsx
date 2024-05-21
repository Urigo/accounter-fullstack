import { ReactElement, ReactNode } from 'react';
import { Link, useMatch, useResolvedPath } from 'react-router-dom';
import { CornJobsButton, FetchIncomeDocumentsButton, Icon, LogoutButton } from './index.js';

type Link = {
  label: string;
  to: string;
};

const links: Link[] = [
  {
    label: 'All Charges',
    to: '/charges',
  },
  {
    label: 'Ledger Validation',
    to: '/charges-ledger-validation',
  },
  {
    label: 'Documents',
    to: '/documents',
  },
  {
    label: 'Businesses',
    to: '/businesses',
  },
  {
    label: 'Business Transactions',
    to: '/business-transactions',
  },
  {
    label: 'Business Trips',
    to: '/business-trips',
  },
  {
    label: 'Trial Balance Report',
    to: '/reports/trial-balance',
  },
  {
    label: 'VAT Monthly Report',
    to: '/reports/vat-monthly',
  },
  {
    label: 'Charts',
    to: '/charts',
  },
  {
    label: 'Tags',
    to: '/tags',
  },
  {
    label: 'Salaries',
    to: '/salaries',
  },
];

export const NavBar = (): ReactElement => {
  return (
    <header className="bg-gray-200">
      <div className="flex flex-wrap p-5 flex-col md:flex-row items-center">
        <Link to="/charges" className="flex font-medium items-center text-gray-900 md:mb-0">
          <Icon name="logo" />
          <span className="ml-3 text-xl">Accounter</span>
        </Link>
        <nav className="ml-5 flex justify-center gap-10">
          {links.map(link => (
            <CustomLink key={link.label} to={link.to}>
              {link.label}
            </CustomLink>
          ))}
          <div className="flex flex-row gap-2">
            <FetchIncomeDocumentsButton />
            <CornJobsButton />
            <LogoutButton />
          </div>
        </nav>
      </div>
    </header>
  );
};

type CustomLinkProps = {
  to: string;
  children: ReactNode;
};

function CustomLink({ to, children, ...props }: CustomLinkProps): ReactElement {
  const resolvedPath = useResolvedPath(to);
  const isActive = useMatch({ path: resolvedPath.pathname });

  return (
    <Link
      className={isActive ? 'rounded-md p-2 bg-gray-300' : 'hover:rounded-md p-2 hover:bg-gray-300'}
      to={to}
      {...props}
    >
      {children}
    </Link>
  );
}
