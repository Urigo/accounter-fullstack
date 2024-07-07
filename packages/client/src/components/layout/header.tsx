import { cn } from '../../lib/utils';
import { MobileSidebar } from './mobile-sidebar';
import { UserNav } from './user-nav';
import { Link } from '@tanstack/react-router';

export function Header(): JSX.Element {
  // const resolvedPath = useMatch({
  //   from: '/',
  // });
  // const titleByPath = navItems.find(link => link.to === resolvedPath.pathname)?.label;

  return (
    <div className="supports-backdrop-blur:bg-background/60 fixed left-0 right-0 top-0 z-20 border-b bg-background/95 backdrop-blur">
      <nav className="flex h-14 items-center justify-between px-4">
        <div className="hidden lg:block">
          <Link to="/">
            <img src="../public/icons/logo.svg" alt="Guild Logo" className="w-[64px] h-[64px]" />
          </Link>
        </div>
        <div className="hidden md:visible md:flex flex-row justify-start gap-3">
          <h1 className="text-xl font-semibold">Accounter</h1>
          {/* {titleByPath && (
            <>
              <h1 className="text-xl"> | </h1>
              <h1 className="text-xl">{titleByPath}</h1>
            </>
          )} */}
        </div>
        <div className={cn('block lg:!hidden')}>
          <MobileSidebar />
        </div>
        <div className="flex items-center gap-2">
          <UserNav />
        </div>
      </nav>
    </div>
  );
}
