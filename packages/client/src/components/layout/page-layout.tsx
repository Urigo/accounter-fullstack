import { type JSX } from 'react';
import { cn } from '../../lib/utils.js';
import { Separator } from '../ui/separator.js';

type PageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
  /** Leaves the title row out of a printed page, for a page that prints a document of its own */
  hideHeaderInPrint?: boolean;
};

export function PageLayout({
  children,
  title,
  description,
  headerActions,
  hideHeaderInPrint = false,
}: PageLayoutProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5" id="main-page">
      <div className={cn('flex justify-between items-center', hideHeaderInPrint && 'print:hidden')}>
        <div>
          <h2 className="w-full text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
          {description && <p className="mt-2 text-gray-500">{description}</p>}
        </div>
        {headerActions}
      </div>
      <Separator className={cn(hideHeaderInPrint && 'print:hidden')} />
      {children}
    </div>
  );
}
