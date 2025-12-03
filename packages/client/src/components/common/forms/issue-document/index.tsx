'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useQuery } from 'urql';
import {
  ClientInfoForDocumentIssuingDocument,
  Currency,
  DocumentType,
  GreenInvoiceDocumentLang,
  GreenInvoiceVatType,
  IssueDocumentClientFieldsFragmentDoc,
  type IssueDocumentClientFieldsFragment,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { useGetAllClients } from '../../../../hooks/use-get-all-clients.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import { Input } from '../../../ui/input.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Textarea } from '../../../ui/textarea.js';
import { ClientForm, normalizeClientInfo } from './client-form.js';
import { IncomeForm } from './income-form.js';
import { PaymentForm } from './payment-form.js';
import type { Income, Payment, PreviewDocumentInput } from './types/document.js';
import {
  getCurrencyOptions,
  getDocumentLangOptions,
  getDocumentTypeOptions,
  getVatTypeOptions,
} from './utils/enum-helpers.js';

export * from './utils/enum-helpers.js';
export * from './types/document.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ClientInfoForDocumentIssuing($businessId: UUID!) {
    client(businessId: $businessId) {
      id
      integrations {
        id
        greenInvoiceInfo {
          id
          greenInvoiceId
          businessId
          name
          ...IssueDocumentClientFields
        }
      }
    }
  }
`;

interface GenerateDocumentProps {
  formData: PreviewDocumentInput;
  updateFormData: <T extends keyof PreviewDocumentInput>(
    field: T,
    value: PreviewDocumentInput[T],
  ) => void;
}

const currencies = getCurrencyOptions();
const documentTypes = getDocumentTypeOptions();
const documentLangs = getDocumentLangOptions();
const vatTypes = getVatTypeOptions();
// const discountTypes = getDiscountTypeOptions();

export function EditIssuedDocumentForm({ formData, updateFormData }: GenerateDocumentProps) {
  // Add state for selected client
  const [selectedClientId, setSelectedClientId] = useState<string>(
    formData.client?.businessId || '',
  );
  const { selectableClients } = useGetAllClients();

  const [clientInfo, setClientInfo] = useState<IssueDocumentClientFieldsFragment | null>(
    formData.client ?? null,
  );

  const [{ data: clientInfoData, fetching: clientFetching }, fetchNewClient] = useQuery({
    pause: true,
    query: ClientInfoForDocumentIssuingDocument,
    variables: {
      businessId: selectedClientId,
    },
  });

  // on client change, trigger fetch
  useEffect(() => {
    if (selectedClientId) {
      fetchNewClient();
    }
  }, [selectedClientId, fetchNewClient]);

  const updateClient = useCallback(
    (clientInfo: IssueDocumentClientFieldsFragment) => {
      const client = normalizeClientInfo(clientInfo);
      setClientInfo(client);
      updateFormData('client', client);
    },
    [updateFormData],
  );

  // on client info data change, update form client
  useEffect(() => {
    if (clientInfoData?.client?.integrations.greenInvoiceInfo) {
      const clientInfo = getFragmentData(
        IssueDocumentClientFieldsFragmentDoc,
        clientInfoData.client.integrations.greenInvoiceInfo,
      );
      updateClient(clientInfo);
    }
  }, [clientInfoData?.client?.integrations.greenInvoiceInfo, updateClient, selectedClientId]);

  // const updateDiscount = <T extends keyof Discount>(field: T, value: Discount[T]) => {
  //   setFormData(prev => ({
  //     ...prev,
  //     discount: {
  //       amount: 0,
  //       type: GreenInvoiceDiscountType.Percentage,
  //       // eslint-disable-next-line unicorn/no-useless-fallback-in-spread
  //       ...(prev.discount ?? {}),
  //       [field]: value,
  //     },
  //   }));
  // };

  const handleClientSelection = (clientId: string) => {
    setSelectedClientId(clientId);

    if (clientId === 'new') {
      // New client selected - reset client data
      const id = `temp-${crypto.randomUUID()}`;
      updateFormData('client', {
        greenInvoiceId: id,
        businessId: id,
        name: '',
      });
    } else if (clientId) {
      // Existing client selected - populate with client data
      const selectedClient = selectableClients.find(c => c.value === clientId);
      if (selectedClient) {
        updateFormData('client', {
          businessId: selectedClient.value,
          name: selectedClient.label,
        });
      }
    }
  };

  const isPaymentRequest =
    formData.type === DocumentType.Proforma || formData.type === DocumentType.Invoice;
  const shouldShowIncome =
    isPaymentRequest ||
    formData.type === DocumentType.InvoiceReceipt ||
    formData.type === DocumentType.CreditInvoice;
  const shouldShowPayment =
    formData.type === DocumentType.Receipt || formData.type === DocumentType.InvoiceReceipt;

  return (
    <>
      {/* Document Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Document Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: DocumentType) => updateFormData('type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={formData.lang}
                onValueChange={(value: GreenInvoiceDocumentLang) => updateFormData('lang', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentLangs.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value: Currency) => updateFormData('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(currency => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatType">VAT Type</Label>
              <Select
                value={formData.vatType}
                onValueChange={(value: GreenInvoiceVatType) => updateFormData('vatType', value)}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientSelect">Select Client</Label>
              <Select value={selectedClientId} onValueChange={handleClientSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose existing client or create new" />
                </SelectTrigger>
                <SelectContent>
                  {/* NOTE: GreenInvoice API supports adding new clients,
                          but we are not using it here. to enable,
                          uncomment the next line */}
                  {/* <SelectItem value="new">+ New Client</SelectItem> */}
                  {selectableClients.map(client => (
                    <SelectItem key={client.value} value={client.value}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Document Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date || ''}
                onChange={e => updateFormData('date', e.target.value)}
              />
            </div>
          </div>

          {isPaymentRequest && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxPayments">Max Payments</Label>
                <Input
                  id="maxPayments"
                  type="number"
                  min="1"
                  max="36"
                  value={formData.maxPayments || ''}
                  onChange={e =>
                    updateFormData('maxPayments', Number.parseInt(e.target.value) || undefined)
                  }
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate || ''}
                  onChange={e => updateFormData('dueDate', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={e => updateFormData('description', e.target.value)}
                    placeholder="Document description"
                    className="min-h-[60px]"
                  />
                </div> */}

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks || ''}
              onChange={e => updateFormData('remarks', e.target.value)}
              placeholder="Additional remarks"
              className="min-h-[60px]"
            />
          </div>

          {/* <div className="space-y-2">
                  <Label htmlFor="footer">Footer Text</Label>
                  <Textarea
                    id="footer"
                    value={formData.footer || ''}
                    onChange={e => updateFormData('footer', e.target.value)}
                    placeholder="Footer text"
                    className="min-h-[60px]"
                  />
                </div> */}

          {/* Discount Section */}
          {/* <div className="space-y-4">
                  <Label>Discount</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="discountAmount">Amount</Label>
                      <Input
                        id="discountAmount"
                        type="number"
                        step="0.01"
                        value={formData.discount?.amount || ''}
                        onChange={e =>
                          updateDiscount('amount', Number.parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountType">Type</Label>
                      <Select
                        value={formData.discount?.type || 'percentage'}
                        onValueChange={(value: GreenInvoiceDiscountType) =>
                          updateDiscount('type', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {discountTypes.map(discount => (
                            <SelectItem key={discount.value} value={discount.value}>
                              {discount.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div> */}

          {/* <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rounding"
                      checked={formData.rounding || false}
                      onCheckedChange={checked => updateFormData('rounding', checked === true)}
                    />
                    <Label htmlFor="rounding">Round amounts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="signed"
                      checked={formData.signed || false}
                      onCheckedChange={checked => updateFormData('signed', checked === true)}
                    />
                    <Label htmlFor="signed">Digital signature</Label>
                  </div>
                </div> */}
        </CardContent>
      </Card>

      {/* Client Form - Only show when "New Client" is selected */}
      {clientInfo && (
        <ClientForm
          client={clientInfo}
          fetching={clientFetching}
          onChange={(client: IssueDocumentClientFieldsFragment) => updateClient(client)}
        />
      )}

      {/* Income Form */}
      {shouldShowIncome && (
        <IncomeForm
          income={formData.income || []}
          currency={formData.currency}
          onChange={(income: Income[]) => updateFormData('income', income)}
        />
      )}

      {/* Payment Form */}
      {shouldShowPayment && (
        <PaymentForm
          payments={formData.payment || []}
          currency={formData.currency}
          onChange={(payment: Payment[]) => updateFormData('payment', payment)}
        />
      )}
    </>
  );
}
