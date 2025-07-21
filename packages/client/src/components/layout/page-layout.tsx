import { type JSX } from 'react';
import { Heading } from '../ui/heading.js';
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
        <Heading title={title} description={description} />
        {headerActions}
      </div>
      <Separator />
      {children}
    </div>
  );
}
