import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type PageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export function PageLayout({ children, title, description }: PageLayoutProps): JSX.Element {
  return (

    <Card>
      <CardHeader>
        <CardTitle className='text-[24px]'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col w-full gap-5">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
