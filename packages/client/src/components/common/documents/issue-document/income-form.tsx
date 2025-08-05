'use client';

import { Plus, Receipt, Trash2 } from 'lucide-react';
import { Currency, GreenInvoiceVatType } from '../../../../gql/graphql.js';
import { Button } from '../../../ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.jsx';
import { Input } from '../../../ui/input.jsx';
import { Label } from '../../../ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.jsx';
import { Textarea } from '../../../ui/textarea.jsx';
import type { Income } from './types/document.js';
import { getVatTypeOptions } from './utils/enum-helpers.js';

interface IncomeFormProps {
  income: Income[];
  currency: Currency;
  onChange: (income: Income[]) => void;
}

const vatTypes = getVatTypeOptions();

export function IncomeForm({ income, currency, onChange }: IncomeFormProps) {
  const addIncomeItem = () => {
    const newItem: Income = {
      description: '',
      price: 0,
      quantity: 1,
      currency,
      vatType: GreenInvoiceVatType.Exempt,
    };
    onChange([...income, newItem]);
  };

  const updateIncomeItem = <T extends keyof Income>(index: number, field: T, value: Income[T]) => {
    const updatedIncome = [...income];
    updatedIncome[index] = { ...updatedIncome[index], [field]: value };
    onChange(updatedIncome);
  };

  const removeIncomeItem = (index: number) => {
    onChange(income.filter((_, i) => i !== index));
  };

  const calculateItemTotal = (item: Income) => {
    const subtotal = item.price * item.quantity;
    const vatRate = item.vatRate || 0;
    const vatAmount = subtotal * (vatRate / 100);
    return subtotal + vatAmount;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Income Items
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {income.map((item, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Item {index + 1}</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeIncomeItem(index)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={item.description}
                onChange={e => updateIncomeItem(index, 'description', e.target.value)}
                placeholder="Item description"
                className="min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catalog Number</Label>
                <Input
                  value={item.catalogNum || ''}
                  onChange={e => updateIncomeItem(index, 'catalogNum', e.target.value)}
                  placeholder="SKU/Catalog #"
                />
              </div>
              <div className="space-y-2">
                <Label>VAT Type</Label>
                <Select
                  value={item.vatType}
                  onValueChange={(value: GreenInvoiceVatType) =>
                    updateIncomeItem(index, 'vatType', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vatTypes.map(vat => (
                      <SelectItem key={vat.value} value={vat.value}>
                        {vat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.price}
                  onChange={e =>
                    updateIncomeItem(index, 'price', Number.parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="1"
                  value={item.quantity}
                  onChange={e =>
                    updateIncomeItem(index, 'quantity', Number.parseInt(e.target.value) || 1)
                  }
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>VAT Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.vatRate || 0}
                  onChange={e =>
                    updateIncomeItem(index, 'vatRate', Number.parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-sm font-medium">
                  {calculateItemTotal(item).toFixed(2)} {currency}
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button onClick={addIncomeItem} variant="outline" className="w-full bg-transparent">
          <Plus className="w-4 h-4 mr-2" />
          Add Income Item
        </Button>

        {income.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-center font-medium">
              <span>Total Amount:</span>
              <span>
                {income.reduce((total, item) => total + calculateItemTotal(item), 0).toFixed(2)}{' '}
                {currency}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
