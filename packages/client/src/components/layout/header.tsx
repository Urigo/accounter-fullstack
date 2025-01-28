import type { JSX } from 'react';
import { Link, useResolvedPath } from 'react-router-dom';
import { cn } from '../../lib/utils.js';
import { MobileSidebar } from './mobile-sidebar.js';
import { sidelinks } from './sidelinks.js';
import { UserNav } from './user-nav.js';

export function Header(): JSX.Element {
  const resolvedPath = useResolvedPath({
    pathname: window.location.pathname,
  });
  const titleByPath =
    sidelinks.find(link => link.href === resolvedPath.pathname)?.title ||
    sidelinks
      .find(link => link.sub?.find(sub => sub.href === resolvedPath.pathname))
      ?.sub?.find(sub => sub.href === resolvedPath.pathname)?.title;

  return (
    <div className="supports-backdrop-blur:bg-white/60 fixed left-0 right-0 top-0 z-20 border-b bg-white/95 backdrop-blur-sm">
      <div className="flex flex-row h-14 items-center justify-between px-4">
        <div className="hidden lg:block">
          <Link to="/">
            <img src="../../../icons/logo.svg" alt="Guild Logo" className="w-[64px] h-[64px]" />
          </Link>
        </div>
        <div className="hidden md:visible md:flex flex-row justify-start gap-3">
          <img
            src="../../../icons/accounter-logo.svg"
            alt="nature"
            className="w-[25px] h-[25px] object-cover"
          />
          <div className="text-xl font-semibold">Accounter</div>
          {titleByPath && (
            <>
              <div className="text-xl"> | </div>
              <div className="text-xl">{titleByPath}</div>
            </>
          )}
        </div>
        <div className={cn('block lg:hidden!')}>
          <MobileSidebar />
        </div>
        <div className="flex items-center gap-2">
          <UserNav />
        </div>
      </div>
    </div>
  );
}
