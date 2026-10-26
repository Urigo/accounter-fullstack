import type { ReactElement } from 'react';
import { useSidebar } from '../../hooks/use-sidebar.js';
import { CloseViewerOnRouteChange } from '../common/document-viewer/close-viewer-on-route-change.js';
import { DockedDocumentViewer } from '../common/document-viewer/docked-viewer.js';
import { OverlayDocumentViewer } from '../common/document-viewer/overlay-viewer.js';
import { Breadcrumbs } from './breadcrumbs.js';
import { Footer } from './footer.js';
import { Header } from './header.js';
import { NavigationProgress } from './navigation-progress.js';
import { Sidebar } from './sidebar.js';

type DashboardLayoutProps = {
  filtersContext: ReactElement | null;
  children: ReactElement;
};

export function DashboardLayout({ children, filtersContext }: DashboardLayoutProps): ReactElement {
  const { isMinimized } = useSidebar();

  return (
    <main>
      <NavigationProgress />
      <Header />
      <div className="flex h-screen overflow-hidden bg-gray-100">
        <Sidebar />
        {/* The work area: the page column, then the docked document viewer when one is open. The
            expanded viewer is positioned against this wrapper. */}
        <div className="relative flex min-w-0 flex-1">
          <div
            className={`overflow-scroll flex flex-col justify-start gap-10 z-0 my-20 pl-10 flex-1 ${isMinimized ? 'pr-10' : 'pr-5'} transition-all`}
          >
            <Breadcrumbs />
            {children}
          </div>
          <DockedDocumentViewer />
        </div>
      </div>
      <Footer filtersContext={filtersContext} />
      <CloseViewerOnRouteChange />
      {/* Portals to the body when open: full screen on phones, or a sheet above an open modal. */}
      <OverlayDocumentViewer />
    </main>
  );
}
