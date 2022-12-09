import { ReactNode } from 'react';

interface props {
  header: string | ReactNode;
  extraLinks?: {
    path: string;
    title: string;
  }[];
  filters?: ReactNode;
}

export const NavBar = ({ header, extraLinks, filters }: props) => {
  return (
    <nav className="border-gray-200 px-2 mb-10">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        {/* Logo */}
        <span className="self-center text-lg font-semibold whitespace-nowrap">{header}</span>
        {/* Links */}
        <div className="flex justify-between items-center w-auto md:order-1">
          <ul className="flex-row flex md:space-x-8 mt-0 text-sm font-medium">
            <li>
              <a
                href="/all-charges"
                className="text-gray-700 border-0 block hover:text-blue-700 hover:bg-gray-50 p-1 rounded"
                aria-current="page"
              >
                All Charges
              </a>
            </li>
            <li>
              <a
                href="/documents"
                className="text-gray-700 border-0 block hover:text-blue-700 hover:bg-gray-50 p-1 rounded"
                aria-current="page"
              >
                Documents
              </a>
            </li>
            <li>
              <a
                href="/business-transactions"
                className="text-gray-700 border-0 block hover:text-blue-700 hover:bg-gray-50 p-1 rounded"
                aria-current="page"
              >
                Business Transactions
              </a>
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
    </nav>
  );
};
