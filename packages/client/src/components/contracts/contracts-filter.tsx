import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { BillingCycle, Product, SubscriptionPlan } from '@/gql/graphql.js';
import { standardBillingCycle, standardPlan } from '@/helpers/index.js';
import type { Table } from '@tanstack/react-table';
import { Label } from '../ui/label.js';
import type { ContractRow } from './index.js';

interface Props {
  table: Table<ContractRow>;
}

export function ContractsFilter({ table }: Props) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Filter className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Contracts</DialogTitle>
          <DialogDescription>Filter contracts based on various criteria</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Product Type</Label>
              <Select
                onValueChange={value =>
                  table.getColumn('product')?.setFilterValue(value === 'NULL' ? undefined : value)
                }
                value={table.getColumn('product')?.getFilterValue() as Product | ''}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NULL" className="font-light text-xs">
                    (None)
                  </SelectItem>
                  {Object.values(Product).map(product => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Select
                onValueChange={value =>
                  table
                    .getColumn('billingCycle')
                    ?.setFilterValue(value === 'NULL' ? undefined : value)
                }
                value={table.getColumn('billingCycle')?.getFilterValue() as BillingCycle | ''}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NULL" className="font-light text-xs">
                    (None)
                  </SelectItem>
                  {Object.values(BillingCycle).map(cycle => (
                    <SelectItem key={cycle} value={cycle}>
                      {standardBillingCycle(cycle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <Select
                onValueChange={value =>
                  table.getColumn('plan')?.setFilterValue(value === 'NULL' ? undefined : value)
                }
                value={table.getColumn('plan')?.getFilterValue() as SubscriptionPlan | ''}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NULL" className="font-light text-xs">
                    (None)
                  </SelectItem>
                  {Object.values(SubscriptionPlan).map(plan => (
                    <SelectItem key={plan} value={plan}>
                      {standardPlan(plan)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Is Active</Label>
              <Select
                onValueChange={value =>
                  table
                    .getColumn('isActive')
                    ?.setFilterValue(
                      value === 'NULL' ? undefined : value === 'active' ? true : false,
                    )
                }
                value={convertBooleanToString(
                  table.getColumn('isActive')?.getFilterValue() as boolean | undefined,
                )}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NULL" className="font-light text-xs">
                    (None)
                  </SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function convertBooleanToString(value: boolean | undefined): string {
  if (value === undefined) {
    return 'NULL';
  }
  return value ? 'active' : 'inactive';
}
