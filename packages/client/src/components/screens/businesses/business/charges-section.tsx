import { DollarSign, MoreVertical, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';

const charges = [
  {
    id: 'CHG-001',
    name: 'Monthly Subscription',
    amount: 99.0,
    frequency: 'Monthly',
    status: 'active',
  },
  { id: 'CHG-002', name: 'Setup Fee', amount: 500.0, frequency: 'One-time', status: 'completed' },
  { id: 'CHG-003', name: 'Premium Support', amount: 49.0, frequency: 'Monthly', status: 'active' },
  {
    id: 'CHG-004',
    name: 'Additional Users',
    amount: 15.0,
    frequency: 'Per user/month',
    status: 'active',
  },
];

export function ChargesSection() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Charges</CardTitle>
            <CardDescription>Recurring and one-time charges for this business</CardDescription>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Charge
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Charge ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {charges.map(charge => (
                <TableRow key={charge.id}>
                  <TableCell className="font-mono text-sm">{charge.id}</TableCell>
                  <TableCell className="font-medium">{charge.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      {charge.amount.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{charge.frequency}</TableCell>
                  <TableCell>
                    <Badge variant={charge.status === 'active' ? 'default' : 'secondary'}>
                      {charge.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Pause</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
