'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Eye, FileText, Loader2, Send } from 'lucide-react';
import {
  Currency,
  DocumentType,
  GreenInvoiceDocumentLang,
  GreenInvoiceVatType,
} from '../../../../gql/graphql.js';
import { useIssueDocument } from '../../../../hooks/use-issue-document.js';
import { usePreviewDocument } from '../../../../hooks/use-preview-document.js';
import { Button } from '../../../ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.jsx';
import {
  EditIssuedDocumentForm,
  getDocumentTypeOptions,
  type PreviewDocumentInput,
} from '../../forms/index.js';
import { IssueDocumentModal, type IssueDocumentData } from './issue-document-modal.js';
import { PdfViewer } from './pdf-viewer.js';
import { RecentBusinessDocs } from './recent-business-docs.js';
import { RecentDocsOfSameType } from './recent-docs-of-same-type.js';

interface GenerateDocumentProps {
  initialFormData?: Partial<PreviewDocumentInput>;
  onDone?: (draft: PreviewDocumentInput) => void;
  chargeId?: string;
}

const documentTypes = getDocumentTypeOptions();

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

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewCurrent, setIsPreviewCurrent] = useState(false);
  const [hasFormChanged, setHasFormChanged] = useState(false);
  const { previewDocument, fetching: previewFetching } = usePreviewDocument();
  const { issueDocument } = useIssueDocument();
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

  const updateFormData = useCallback(
    <T extends keyof PreviewDocumentInput>(field: T, value: PreviewDocumentInput[T]) => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  // Track form changes
  useEffect(() => {
    setHasFormChanged(true);
    setIsPreviewCurrent(false);
  }, [formData]);

  useEffect(() => {
    if (initialFormData.client?.id && formData.client?.id !== initialFormData.client.id) {
      updateFormData('client', {
        ...formData.client,
        id: initialFormData.client.id,
      });
    }
  }, [updateFormData, formData, initialFormData.client?.id]);

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
    if (onDone) {
      onDone(formData);
    } else {
      setIsIssueModalOpen(true);
    }
  };

  const handleIssue = async (issueData: IssueDocumentData) => {
    console.log('Issuing document with data:', formData, issueData);

    await issueDocument({
      input: formData,
      chargeId,
      ...issueData,
    });
  };

  const isIssueDisabled = !isPreviewCurrent || previewFetching || hasFormChanged;

  const totalAmount =
    formData.income?.reduce((total, item) => {
      const subtotal = item.price * item.quantity;
      const vatAmount = subtotal * ((item.vatRate || 0) / 100);
      return total + subtotal + vatAmount;
    }, 0) || 0;

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
            <EditIssuedDocumentForm formData={formData} updateFormData={updateFormData} />

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
                    {onDone ? 'Accept Changes' : 'Issue Document'}
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
            {formData.client?.id && (
              <RecentBusinessDocs
                businessId={formData.client?.id}
                linkedDocumentIds={formData.linkedDocumentIds ?? []}
              />
            )}

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
