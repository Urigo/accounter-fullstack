'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Eye, FileText, Loader2, Send, Settings } from 'lucide-react';
import { useQuery } from 'urql';
import {
  ClientInfoForDocumentIssuingDocument,
  Currency,
  DocumentType,
  GreenInvoiceDocumentLang,
  GreenInvoiceVatType,
  IssueDocumentClientFieldsFragment,
  IssueDocumentClientFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { useGetGreenInvoiceClients } from '../../../../hooks/use-get-green-invoice-clients.js';
import { useIssueDocument } from '../../../../hooks/use-issue-document.js';
import { usePreviewDocument } from '../../../../hooks/use-preview-document.js';
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
import { ClientForm, normalizeClientInfo } from './client-form.jsx';
import { IncomeForm } from './income-form.jsx';
import { IssueDocumentData, IssueDocumentModal } from './issue-document-modal.js';
import { PaymentForm } from './payment-form.jsx';
import { PdfViewer } from './pdf-viewer.js';
import { RecentClientDocs } from './recent-client-docs.js';
import { RecentDocsOfSameType } from './recent-docs-of-same-type.js';
import type { Income, Payment, PreviewDocumentInput } from './types/document.js';
import {
  getCurrencyOptions,
  getDocumentLangOptions,
  getDocumentTypeOptions,
  getVatTypeOptions,
} from './utils/enum-helpers.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ClientInfoForDocumentIssuing($businessId: UUID!) {
    greenInvoiceBusiness(businessId: $businessId) {
      id
      clientInfo {
        id
        ...IssueDocumentClientFields
      }
    }
  }
`;

interface GenerateDocumentProps {
  initialFormData?: Partial<PreviewDocumentInput>;
  onDone?: () => void;
  chargeId?: string;
}

const currencies = getCurrencyOptions();
const documentTypes = getDocumentTypeOptions();
const documentLangs = getDocumentLangOptions();
const vatTypes = getVatTypeOptions();
// const discountTypes = getDiscountTypeOptions();

export function GenerateDocument({
  initialFormData = {},
  onDone,
  chargeId,
}: GenerateDocumentProps) {
  const [formData, setFormData] = useState<PreviewDocumentInput>({
    type: DocumentType.Invoice,
    lang: GreenInvoiceDocumentLang.English,
    currency: Currency.Usd,
    vatType: GreenInvoiceVatType.Default,
    date: format(new Date(), 'yyyy-MM-dd'),
    rounding: false,
    signed: true,
    income: [],
    payment: [],
    ...initialFormData,
  });

  // Add state for selected client
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const { selectableGreenInvoiceClients } = useGetGreenInvoiceClients();

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewCurrent, setIsPreviewCurrent] = useState(false);
  const [hasFormChanged, setHasFormChanged] = useState(false);
  const { previewDocument, fetching: previewFetching } = usePreviewDocument();
  const { issueDocument } = useIssueDocument();
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
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

  const updateFormData = useCallback(
    <T extends keyof PreviewDocumentInput>(field: T, value: PreviewDocumentInput[T]) => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

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
    if (clientInfoData?.greenInvoiceBusiness?.clientInfo) {
      const clientInfo = getFragmentData(
        IssueDocumentClientFieldsFragmentDoc,
        clientInfoData.greenInvoiceBusiness.clientInfo,
      );
      updateClient({ ...clientInfo, id: selectedClientId });
    }
  }, [clientInfoData?.greenInvoiceBusiness?.clientInfo, updateClient, selectedClientId]);

  // Track form changes
  useEffect(() => {
    setHasFormChanged(true);
    setIsPreviewCurrent(false);
  }, [formData]);

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

  useEffect(() => {
    if (initialFormData.client?.id) {
      setSelectedClientId(initialFormData.client.id);
    }
  }, [initialFormData.client?.id]);

  const handleClientSelection = (clientId: string) => {
    setSelectedClientId(clientId);

    if (clientId === 'new') {
      // New client selected - reset client data
      updateFormData('client', {
        id: `temp-${crypto.randomUUID()}`,
        name: '',
      });
    } else if (clientId) {
      // Existing client selected - populate with client data
      const selectedClient = selectableGreenInvoiceClients.find(c => c.value === clientId);
      if (selectedClient) {
        updateFormData('client', {
          id: selectedClient.value,
          name: selectedClient.label,
        });
      }
    }
  };

  const handlePreview = async () => {
    try {
      // Simulate API call to generate document preview
      const fileText = await previewDocument({
        input: formData,
      });

      if (!fileText) {
        throw new Error('No preview data returned');
      }

      setPreviewContent(fileText);
      setIsPreviewCurrent(true);
      setHasFormChanged(false);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  const handleIssueClick = () => {
    setIsIssueModalOpen(true);
  };

  const handleIssue = async (issueData: IssueDocumentData) => {
    console.log('Issuing document with data:', formData, issueData);

    await issueDocument({
      input: formData,
      chargeId,
      ...issueData,
    });

    onDone?.();
  };

  const isIssueDisabled = !isPreviewCurrent || previewFetching || hasFormChanged;

  const totalAmount =
    formData.income?.reduce((total, item) => {
      const subtotal = item.price * item.quantity;
      const vatAmount = subtotal * ((item.vatRate || 0) / 100);
      return total + subtotal + vatAmount;
    }, 0) || 0;

  const isPaymentRequest =
    formData.type === DocumentType.Proforma || formData.type === DocumentType.Invoice;
  const shouldShowIncome =
    isPaymentRequest ||
    formData.type === DocumentType.InvoiceReceipt ||
    formData.type === DocumentType.CreditInvoice;
  const shouldShowPayment =
    formData.type === DocumentType.Receipt || formData.type === DocumentType.InvoiceReceipt;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Generate Document</h1>
          <p className="text-gray-600 mt-2">
            Create and preview your accounting document before issuing
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-6">
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
                      onValueChange={(value: GreenInvoiceDocumentLang) =>
                        updateFormData('lang', value)
                      }
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
                      onValueChange={(value: GreenInvoiceVatType) =>
                        updateFormData('vatType', value)
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
                        {selectableGreenInvoiceClients.map(client => (
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
                          updateFormData(
                            'maxPayments',
                            Number.parseInt(e.target.value) || undefined,
                          )
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

            {/* Action Buttons */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Button
                    onClick={handlePreview}
                    disabled={previewFetching || isPreviewCurrent}
                    variant="outline"
                    className="flex-1 bg-transparent"
                  >
                    {previewFetching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </>
                    )}
                  </Button>

                  <Button onClick={handleIssueClick} disabled={isIssueDisabled} className="flex-1">
                    <Send className="w-4 h-4 mr-2" />
                    Issue Document
                  </Button>
                </div>

                {hasFormChanged && !previewFetching && (
                  <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded mt-3">
                    Form has been modified. Click Preview to update the document before issuing.
                  </p>
                )}

                {totalAmount > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center font-medium text-blue-900">
                      <span>Total Document Amount:</span>
                      <span>
                        {totalAmount.toFixed(2)} {formData.currency}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview and previous documents section */}
          <div className="space-y-6">
            {/* Preview Section */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-200 rounded-lg min-h-[600px] flex items-center justify-center bg-gray-50">
                  {previewFetching ? (
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">Generating document preview...</p>
                    </div>
                  ) : previewContent ? (
                    <div className="w-full">
                      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                        <div className="aspect-[8.5/11] bg-white border">
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center p-6">
                              <PdfViewer src={previewContent} />
                              {!isPreviewCurrent && (
                                <p className="text-xs text-amber-600 mt-3 bg-amber-50 px-2 py-1 rounded">
                                  Preview may be outdated
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500 mb-2">No preview available</p>
                      <p className="text-sm text-gray-400">Click Preview to generate document</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Previous client documents */}
            <RecentClientDocs
              clientId={selectedClientId}
              linkedDocumentIds={formData.linkedDocumentIds ?? []}
            />

            {/* Previous similar-types documents */}
            <RecentDocsOfSameType documentType={formData.type} />
          </div>
        </div>
        {/* Issue Document Modal */}
        <IssueDocumentModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          onIssue={handleIssue}
          clientName={formData.client?.name}
          clientEmails={formData.client?.emails}
          documentType={documentTypes.find(t => t.value === formData.type)?.value}
        />
      </div>
    </div>
  );
}
