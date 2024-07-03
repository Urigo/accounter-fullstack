import { ReactElement } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Footer } from './footer';
import { Header } from './header';
import { Sidebar } from './sidebar';

type DashboardLayoutProps = {
  filtersContext: ReactElement | null;
  children: ReactElement;
};

export function DashboardLayout({ children, filtersContext }: DashboardLayoutProps): ReactElement {
  return (
    <main>
      <Header />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="z-0 flex-1 overflow-hidden pt-16 px-10 mb-20">
          <ScrollArea className="h-full w-full">{children}</ScrollArea>
        </div>
      </div>
      <Footer filtersContext={filtersContext} />
    </main>
  );
}
