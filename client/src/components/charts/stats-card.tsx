import { ReactElement } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './cards';

interface StatsCardProps {
  items: {
    title: string;
    number: number | string;
    color?: 'red' | 'green';
  }[];
}

export const StatsCard = ({ items }: StatsCardProps): ReactElement => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-10">
      {items.map(item => (
        <Card key={item.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.number}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
