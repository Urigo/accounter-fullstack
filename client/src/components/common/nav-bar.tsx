import { ReactNode } from 'react';
import { NavLink } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

interface props {
  header: string | ReactNode;
  extraLinks?: {
    path: string;
    title: string;
  }[];
  filters?: ReactNode;
}

export const NavBar = ({ header, extraLinks, filters }: props) => {
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
              onClick={() => navigate('/all-charges')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Documents"
              onClick={() => navigate('/documents')}
            />
          </li>
          <li>
            <NavLink
              className="text-gray-700 rounded"
              label="Business Transactions"
              onClick={() => navigate('/business-transactions')}
            />
          </li>
          <li>
            <NavLink className="text-gray-700 rounded" label="Reports" childrenOffset={28}>
              <NavLink
                className="text-gray-700 rounded"
                label="Trial Balance Report"
                onClick={() => navigate('/reports/trial-balance')}
              />
            </NavLink>
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
