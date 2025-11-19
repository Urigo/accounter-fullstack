import { Fullscreen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { ROUTES } from '@/router/routes.js';
import { BusinessExtendedInfo } from '../business-ledger/business-extended-info';
import { Button } from '../ui/button';

interface Props {
  businessId: string;
}

export function BalanceSection({ businessId }: Props) {
  return (
    <Card>
      <CardHeader className="flex w-full justify-between items-center">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Balance</CardTitle>
            <CardDescription>Business balance overview</CardDescription>
          </div>
        </div>
        <Link to={ROUTES.BUSINESSES.DETAIL_LEDGER(businessId)}>
          <Button variant="outline" size="icon">
            <Fullscreen />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <BusinessExtendedInfo businessID={businessId} filter={{}} />
        </div>
      </CardContent>
    </Card>
  );
}
