import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { BusinessExtendedInfo } from '../business-ledger/business-extended-info';

interface Props {
  businessId: string;
}

export function TransactionsSection({ businessId }: Props) {
  return (
    <Card>
      <CardHeader className="flex w-full justify-between items-center">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Complete transaction history for this business</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <BusinessExtendedInfo businessID={businessId} filter={{}} />
        </div>
      </CardContent>
    </Card>
  );
}
