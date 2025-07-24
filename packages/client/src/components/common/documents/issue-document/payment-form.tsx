'use client';

import { CreditCard, Plus, Trash2 } from 'lucide-react';
import {
  GreenInvoiceCurrency,
  GreenInvoicePaymentAppType,
  GreenInvoicePaymentCardType,
  GreenInvoicePaymentDealType,
  GreenInvoicePaymentSubType,
  GreenInvoicePaymentType,
} from '../../../../gql/graphql.js';
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
import type { Payment } from './types/document.js';
import {
  getAppTypeOptions,
  getCardTypeOptions,
  getCurrencyOptions,
  getDealTypeOptions,
  getPaymentTypeOptions,
  getSubTypeOptions,
} from './utils/enum-helpers.js';

interface PaymentFormProps {
  payments: Payment[];
  currency: GreenInvoiceCurrency;
  onChange: (payments: Payment[]) => void;
}

const currencies = getCurrencyOptions();
const paymentTypes = getPaymentTypeOptions();
const subTypes = getSubTypeOptions();
const appTypes = getAppTypeOptions();
const cardTypes = getCardTypeOptions();
const dealTypes = getDealTypeOptions();

export function PaymentForm({ payments, currency, onChange }: PaymentFormProps) {
  const addPayment = () => {
    const newPayment: Payment = {
      currency,
      price: 0,
      type: GreenInvoicePaymentType.Cash,
      date: new Date().toISOString().split('T')[0],
    };
    onChange([...payments, newPayment]);
  };

  const updatePayment = <T extends keyof Payment>(index: number, field: T, value: Payment[T]) => {
    const updatedPayments = [...payments];
    updatedPayments[index] = { ...updatedPayments[index], [field]: value };
    onChange(updatedPayments);
  };

  const removePayment = (index: number) => {
    onChange(payments.filter((_, i) => i !== index));
  };

  const getPaymentTypeLabel = (type: GreenInvoicePaymentType) => {
    return paymentTypes.find(pt => pt.value === type)?.label || type;
  };

  const shouldShowBankFields = (type: GreenInvoicePaymentType) => {
    return type === GreenInvoicePaymentType.Cheque;
  };

  const shouldShowCardFields = (type: GreenInvoicePaymentType) => {
    return type === GreenInvoicePaymentType.CreditCard;
  };

  const shouldShowPayPalFields = (type: GreenInvoicePaymentType) => {
    return type === GreenInvoicePaymentType.Paypal;
  };

  const shouldShowAppFields = (type: GreenInvoicePaymentType) => {
    return type === GreenInvoicePaymentType.PaymentApp;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payments.map((payment, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">
                Payment {index + 1} - {getPaymentTypeLabel(payment.type)}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removePayment(index)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Basic Payment Info */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select
                  value={payment.type}
                  onValueChange={(value: GreenInvoicePaymentType) =>
                    updatePayment(index, 'type', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payment.price}
                  onChange={e =>
                    updatePayment(index, 'price', Number.parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={payment.currency}
                  onValueChange={(value: GreenInvoiceCurrency) =>
                    updatePayment(index, 'currency', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(curr => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={payment.date || ''}
                  onChange={e => updatePayment(index, 'date', e.target.value)}
                />
              </div>
            </div>

            {/* Currency Rate and Sub Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency Rate (relative to ILS)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={payment.currencyRate || ''}
                  onChange={e =>
                    updatePayment(
                      index,
                      'currencyRate',
                      Number.parseFloat(e.target.value) || undefined,
                    )
                  }
                  placeholder="1.0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Sub Type</Label>
                <Select
                  value={payment.subType || ''}
                  onValueChange={(value: GreenInvoicePaymentSubType) =>
                    updatePayment(index, 'subType', value || undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {subTypes.map(subType => (
                      <SelectItem key={subType.value} value={subType.value}>
                        {subType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bank Fields for Cheques */}
            {shouldShowBankFields(payment.type) && (
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-gray-700">
                  Bank Details (Required for Cheques)
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={payment.bankName || ''}
                      onChange={e => updatePayment(index, 'bankName', e.target.value)}
                      placeholder="Bank name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Branch</Label>
                    <Input
                      value={payment.bankBranch || ''}
                      onChange={e => updatePayment(index, 'bankBranch', e.target.value)}
                      placeholder="Branch number"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <Input
                      value={payment.bankAccount || ''}
                      onChange={e => updatePayment(index, 'bankAccount', e.target.value)}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cheque Number</Label>
                    <Input
                      value={payment.chequeNum || ''}
                      onChange={e => updatePayment(index, 'chequeNum', e.target.value)}
                      placeholder="Cheque number"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Credit Card Fields */}
            {shouldShowCardFields(payment.type) && (
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-gray-700">Credit Card Details</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Card Type</Label>
                    <Select
                      value={payment.cardType || ''}
                      onValueChange={(value: GreenInvoicePaymentCardType) =>
                        updatePayment(index, 'cardType', value || undefined)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select card type" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardTypes.map(cardType => (
                          <SelectItem key={cardType.value} value={cardType.value}>
                            {cardType.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Last 4 Digits</Label>
                    <Input
                      value={payment.cardNum || ''}
                      onChange={e => updatePayment(index, 'cardNum', e.target.value)}
                      placeholder="1234"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deal Type</Label>
                    <Select
                      value={payment.dealType || ''}
                      onValueChange={(value: GreenInvoicePaymentDealType) =>
                        updatePayment(index, 'dealType', value || undefined)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select deal type" />
                      </SelectTrigger>
                      <SelectContent>
                        {dealTypes.map(dealType => (
                          <SelectItem key={dealType.value} value={dealType.value}>
                            {dealType.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Number of Payments (1-36)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="36"
                      value={payment.numPayments || ''}
                      onChange={e =>
                        updatePayment(
                          index,
                          'numPayments',
                          Number.parseInt(e.target.value) || undefined,
                        )
                      }
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>First Payment Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payment.firstPayment || ''}
                      onChange={e =>
                        updatePayment(
                          index,
                          'firstPayment',
                          Number.parseFloat(e.target.value) || undefined,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PayPal Fields */}
            {shouldShowPayPalFields(payment.type) && (
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-gray-700">PayPal Details</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account ID</Label>
                    <Input
                      value={payment.accountId || ''}
                      onChange={e => updatePayment(index, 'accountId', e.target.value)}
                      placeholder="PayPal account ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transaction ID</Label>
                    <Input
                      value={payment.transactionId || ''}
                      onChange={e => updatePayment(index, 'transactionId', e.target.value)}
                      placeholder="Transaction ID"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment App Fields */}
            {shouldShowAppFields(payment.type) && (
              <div className="space-y-4">
                <h5 className="font-medium text-sm text-gray-700">Payment App Details</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>App Type</Label>
                    <Select
                      value={payment.appType || ''}
                      onValueChange={(value: GreenInvoicePaymentAppType) =>
                        updatePayment(index, 'appType', value || undefined)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select app type" />
                      </SelectTrigger>
                      <SelectContent>
                        {appTypes.map(appType => (
                          <SelectItem key={appType.value} value={appType.value}>
                            {appType.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account ID</Label>
                    <Input
                      value={payment.accountId || ''}
                      onChange={e => updatePayment(index, 'accountId', e.target.value)}
                      placeholder="App account ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transaction ID</Label>
                    <Input
                      value={payment.transactionId || ''}
                      onChange={e => updatePayment(index, 'transactionId', e.target.value)}
                      placeholder="Transaction ID"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <Button onClick={addPayment} variant="outline" className="w-full bg-transparent">
          <Plus className="w-4 h-4 mr-2" />
          Add Payment
        </Button>

        {payments.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-center font-medium">
              <span>Total Payments:</span>
              <span>
                {payments.reduce((total, payment) => total + payment.price, 0).toFixed(2)}{' '}
                {currency}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
