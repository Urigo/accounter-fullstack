import { type JSX } from 'react';
import { Separator } from '../ui/separator.js';

type PageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
};

export function PageLayout({
  children,
  title,
  description,
  headerActions,
}: PageLayoutProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5" id="main-page">
      <div className="flex justify-between items-center">
        <h2 className="w-full text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-gray-500">{description}</p>}
        {headerActions}
      </div>
      <Separator />
      {children}
    </div>
  );
}
