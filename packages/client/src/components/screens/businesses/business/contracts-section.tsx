import { Calendar, DollarSign, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Progress } from '@/components/ui/progress.js';

const contracts = [
  {
    id: 'CNT-2024-001',
    client: 'Tech Solutions Inc.',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    value: 15_000,
    paid: 10_000,
    status: 'active',
    poNumber: 'PO-2024-TS-001',
    billingCycle: 'Monthly',
  },
  {
    id: 'CNT-2024-002',
    client: 'Digital Agency Co.',
    startDate: '2024-06-01',
    endDate: '2025-05-31',
    value: 24_000,
    paid: 8000,
    status: 'active',
    poNumber: 'PO-2024-DA-002',
    billingCycle: 'Quarterly',
  },
  {
    id: 'CNT-2023-015',
    client: 'Startup Ventures',
    startDate: '2023-03-01',
    endDate: '2024-02-29',
    value: 12_000,
    paid: 12_000,
    status: 'completed',
    poNumber: 'PO-2023-SV-015',
    billingCycle: 'Monthly',
  },
];

export function ContractsSection() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>Active and past contracts with payment tracking</CardDescription>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contracts.map(contract => {
          const progress = (contract.paid / contract.value) * 100;

          return (
            <div key={contract.id} className="rounded-lg border p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{contract.client}</h4>
                    <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                      {contract.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{contract.id}</p>
                </div>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  View
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Contract Period
                  </p>
                  <p className="text-sm font-medium">
                    {contract.startDate} → {contract.endDate}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="text-sm font-medium font-mono">{contract.poNumber}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Billing Cycle</p>
                  <p className="text-sm font-medium">{contract.billingCycle}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Payment Progress
                  </span>
                  <span className="font-medium">
                    ${contract.paid.toLocaleString()} / ${contract.value.toLocaleString()}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
