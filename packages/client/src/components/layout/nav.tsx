import { Link } from 'react-router-dom';
import { ChevronDown } from 'tabler-icons-react';
import { cn } from '../../lib/utils.js';
import { Button, buttonVariants } from '../ui/button.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { ScrollArea } from '../ui/scroll-area.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip.js';
import { SideLink } from './sidelinks.js';

interface NavProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean;
  links: SideLink[];
  closeNav: () => void;
}

export function Nav({ links, isCollapsed, closeNav }: NavProps): JSX.Element {
  const renderLink = ({ sub, ...rest }: SideLink): JSX.Element => {
    const key = `${rest.title}-${rest.href}`;
    if (isCollapsed && sub)
      return <NavLinkIconDropdown {...rest} sub={sub} key={key} closeNav={closeNav} />;

    if (isCollapsed) return <NavLinkIcon {...rest} key={key} closeNav={closeNav} />;

    if (sub) return <NavLinkDropdown {...rest} sub={sub} key={key} closeNav={closeNav} />;

    return <NavLink {...rest} key={key} closeNav={closeNav} />;
  };
  return (
    <ScrollArea className="h-screen pb-40">
      <TooltipProvider delayDuration={0}>
        <nav className="grid grid-cols-1 items-start gap-2">{links.map(renderLink)}</nav>
      </TooltipProvider>
    </ScrollArea>
  );
}

interface NavLinkProps extends SideLink {
  subLink?: boolean;
  closeNav: () => void;
}

function NavLink({
  title,
  icon,
  label,
  href,
  closeNav,
  subLink = false,
}: NavLinkProps): JSX.Element {
  return (
    <Link
      to={href}
      onClick={closeNav}
      className={cn(
        buttonVariants({
          variant: 'ghost',
          size: 'sm',
        }),
        'h-12 font-semibold tracking-tight justify-start text-wrap rounded-none px-6',
        subLink && 'h-10 w-full border-l border-l-slate-500 px-2',
      )}
      aria-current="page"
    >
      <div className="mr-2">{icon}</div>
      {title}
      {label && (
        <div className="ml-2 rounded-lg bg-primary px-1 text-[0.625rem] text-primary-foreground">
          {label}
        </div>
      )}
    </Link>
  );
}

function NavLinkDropdown({ title, icon, label, sub, closeNav }: NavLinkProps): JSX.Element {
  /* Open collapsible by default
   * if one of child element is active */
  const isChildActive = !!sub?.find((s: SideLink) => s.href === window.location.pathname);

  return (
    <Collapsible defaultOpen={isChildActive}>
      <CollapsibleTrigger
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'group h-12 w-full justify-start rounded-none px-6',
        )}
      >
        <div className="mr-2">{icon}</div>
        <div className="font-semibold tracking-tight">{title}</div>
        {label && (
          <div className="ml-2  rounded-lg bg-primary px-1 text-[0.625rem] text-primary-foreground">
            {label}
          </div>
        )}
        <span className={cn('ml-auto transition-all group-data-[state="open"]:-rotate-180')}>
          <ChevronDown />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="collapsibleDropdown" asChild>
        <ul>
          {sub!.map(sublink => (
            <li key={sublink.title} className="my-1 ml-8">
              <NavLink {...sublink} subLink closeNav={closeNav} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavLinkIcon({ title, icon, label, href }: NavLinkProps): JSX.Element {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          to={href}
          className={cn(
            buttonVariants({
              variant: 'ghost',
              size: 'icon',
            }),
            'h-12 w-12',
          )}
        >
          {icon}
          <span className="sr-only">{title}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="flex font-semibold tracking-tight items-center gap-4">
        {title}
        {label && <span className="ml-auto text-muted-foreground">{label}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function NavLinkIconDropdown({ title, icon, label, sub }: NavLinkProps): JSX.Element {
  /* Open collapsible by default
   * if one of child element is active */
  const isChildActive = !!sub?.find(s => s.href === window.location.pathname);

  return (
    <DropdownMenu>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isChildActive ? 'secondary' : 'ghost'}
              size="icon"
              className="h-12 w-12"
            >
              {icon}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="flex font-semibold tracking-tight items-center gap-4"
        >
          {title} {label && <span className="ml-auto text-muted-foreground">{label}</span>}
          <ChevronDown size={18} className="-rotate-90 text-muted-foreground" />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" sideOffset={4}>
        <DropdownMenuLabel>
          {title} {label ? `(${label})` : ''}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sub!.map(({ title, icon, label, href }) => (
          <DropdownMenuItem key={`${title}-${href}`} asChild>
            <Link
              to={href}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                }),
                'flex h-12 cursor-pointer justify-start text-wrap rounded-none px-6',
              )}
            >
              {icon}{' '}
              <span className="ml-2 max-w-52 text-wrap font-semibold tracking-tight">{title}</span>
              {label && <span className="ml-auto text-xs">{label}</span>}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
