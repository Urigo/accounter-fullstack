import { Heading } from '../ui/heading';
import { Separator } from '../ui/separator';

type PageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export function PageLayout({ children, title, description }: PageLayoutProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <Heading title={title} description={description} />
      <Separator />
      {children}
    </div>
  );
}
