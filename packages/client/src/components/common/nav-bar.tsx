import { ReactElement, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@mantine/core';

interface props {
  header: string | ReactNode;
  extraLinks?: {
    path: string;
    title: string;
  }[];
  filters?: ReactNode;
}

export const NavBar = ({ header, extraLinks, filters }: props): ReactElement => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto flex flex-wrap items-center justify-between border-gray-200 px-2 mb-10">
      {/* Logo */}
      <span className="self-center text-lg font-semibold whitespace-nowrap">{header}</span>
      {/* Links */}
      <div className="flex justify-between items-center w-auto md:order-1">
        <ul className="flex-row flex md:space-x-8 mt-0 text-sm font-medium">
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="All Charges"
              onClick={(): void => navigate('/charges')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Documents"
              onClick={(): void => navigate('/documents')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Businesses"
              onClick={(): void => navigate('/businesses')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Business Transactions"
              onClick={(): void => navigate('/business-transactions')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Business Trips"
              onClick={(): void => navigate('/business-trips')}
            />
          </li>
          <li>
            <NavLink className="text-gray-700 rounded" label="Reports" childrenOffset={28}>
              <NavLink
                className="text-gray-700 rounded"
                label="Trial Balance Report"
                onClick={(): void => navigate('/reports/trial-balance')}
              />
              <NavLink
                className="text-gray-700 rounded"
                label="VAT Monthly Report"
                onClick={(): void => navigate('/reports/vat-monthly')}
              />
            </NavLink>
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Tags"
              onClick={(): void => navigate('/tags')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Salaries"
              onClick={(): void => navigate('/salaries')}
            />
          </li>
          {extraLinks?.map(link => (
            <li key={link.title}>
              <a
                href={link.path}
                className="text-gray-700 border-0 block hover:text-blue-700 hover:bg-gray-50 p-1 rounded"
                aria-current="page"
              >
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Filters */}
      <div className="flex order-2">{filters ?? null}</div>
    </div>
  );
};
