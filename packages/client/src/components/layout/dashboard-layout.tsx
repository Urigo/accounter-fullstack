import { ReactElement } from 'react';
import { useSidebar } from '../../hooks/use-sidebar.js';
import { Footer } from './footer.js';
import { Header } from './header.js';
import { Sidebar } from './sidebar.js';

type DashboardLayoutProps = {
  filtersContext: ReactElement | null;
  children: ReactElement;
};

export function DashboardLayout({ children, filtersContext }: DashboardLayoutProps): ReactElement {
  const { isMinimized } = useSidebar();

  return (
    <main>
      <Header />
      <div className="flex h-screen overflow-hidden bg-gray-100">
        <Sidebar />
        <div
          className={`overflow-scroll flex flex-col justify-start gap-10 z-0 my-20 pl-10 flex-1 ${isMinimized ? 'pr-10' : 'pr-5'} transition-all`}
        >
          {children}
        </div>
      </div>
      <Footer filtersContext={filtersContext} />
    </main>
  );
}
