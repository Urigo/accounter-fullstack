import type { JSX } from 'react';
import { Link, useResolvedPath } from 'react-router-dom';
import { Building2, Eye } from 'lucide-react';
import { useIsReadOnly } from '../../hooks/use-role.js';
import { cn } from '../../lib/utils.js';
import { useWorkspaceDisplayName, useWorkspaceLogo } from '../../providers/workspace-provider.js';
import { Badge } from '../ui/badge.js';
import { MobileSidebar } from './mobile-sidebar.js';
import { SetupIndicator } from './setup-indicator.js';
import { sidelinks } from './sidelinks.js';
import { SourceHealthBadge } from './source-health.js';
import { UserNav } from './user-nav.js';

function WorkspaceLogo({ className }: { className?: string }): JSX.Element {
  const logoUrl = useWorkspaceLogo();
  const name = useWorkspaceDisplayName();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn('object-contain', className)}
        onError={e => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md bg-slate-800 text-white font-semibold text-sm',
        className,
      )}
    >
      <Building2 size={18} />
    </div>
  );
}

export function Header(): JSX.Element {
  const resolvedPath = useResolvedPath({
    pathname: window.location.pathname,
  });
  const companyName = useWorkspaceDisplayName();
  const isReadOnly = useIsReadOnly();
  const titleByPath =
    sidelinks.find(link => link.href === resolvedPath.pathname)?.title ||
    sidelinks
      .find(link => link.sub?.find(sub => sub.href === resolvedPath.pathname))
      ?.sub?.find(sub => sub.href === resolvedPath.pathname)?.title;

  return (
    <div className="supports-backdrop-blur:bg-white/60 fixed left-0 right-0 top-0 z-20 border-b bg-white/95 backdrop-blur-sm">
      <nav className="flex h-14 items-center justify-between px-4">
        <div className="hidden lg:block">
          <Link to="/" className="flex items-center gap-2">
            <WorkspaceLogo className="w-8 h-8" />
          </Link>
        </div>
        <div className="hidden md:visible md:flex flex-row items-center justify-start gap-3">
          <WorkspaceLogo className="w-[25px] h-[25px]" />
          <h1 className="text-xl font-semibold">{companyName}</h1>
          {titleByPath && (
            <>
              <span className="text-xl text-slate-300">|</span>
              <h1 className="text-xl text-slate-600">{titleByPath}</h1>
            </>
          )}
        </div>
        <div className={cn('block lg:hidden!')}>
          <MobileSidebar />
        </div>
        <div className="flex items-center gap-2">
          {isReadOnly && (
            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
              <Eye size={12} />
              Observer
            </Badge>
          )}
          <SourceHealthBadge />
          <SetupIndicator />
          <UserNav />
        </div>
      </nav>
    </div>
  );
}
