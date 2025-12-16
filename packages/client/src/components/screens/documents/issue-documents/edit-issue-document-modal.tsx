import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Check, Edit, Eye, FileText, Loader2 } from 'lucide-react';
import { usePreviewDocument } from '../../../../hooks/use-preview-document.js';
import { PdfViewer } from '../../../common/documents/issue-document/pdf-viewer.js';
import { RecentBusinessDocs } from '../../../common/documents/issue-document/recent-business-docs.js';
import { RecentDocsOfSameType } from '../../../common/documents/issue-document/recent-docs-of-same-type.js';
import { EditIssuedDocumentForm, type PreviewDocumentInput } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import { Dialog, DialogContent, DialogTrigger } from '../../../ui/dialog.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip.js';

type Props = {
  onApprove: (draft: PreviewDocumentInput) => void;
  draft: PreviewDocumentInput;
};

export function EditIssueDocumentModal({ onApprove, draft }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [isPreviewCurrent, setIsPreviewCurrent] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const { previewDocument, fetching: previewFetching } = usePreviewDocument();
  const [document, setDocument] = useState<PreviewDocumentInput>(draft);

  const updateFormData = useCallback(
    <T extends keyof PreviewDocumentInput>(field: T, value: PreviewDocumentInput[T]) => {
      setDocument(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  // Track form changes
  useEffect(() => {
    setIsPreviewCurrent(false);
  }, [document]);

  const handlePreview = useCallback(async () => {
    try {
      const fileText = await previewDocument({
        input: document,
      });

      if (!fileText) {
        throw new Error('No preview data returned');
      }

      setPreviewContent(fileText);
      setIsPreviewCurrent(true);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  }, [document, previewDocument]);

  useEffect(() => {
    if (open && !previewContent) {
      handlePreview();
    }
  }, [open, previewContent, handlePreview]);

  const totalAmount =
    document.income?.reduce((total, item) => {
      const subtotal = item.price * item.quantity;
      const vatAmount = subtotal * ((item.vatRate || 0) / 100);
      return total + subtotal + vatAmount;
    }, 0) || 0;

  const onApproveHandler = () => {
    onApprove(document);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild type="button">
        <Tooltip>
          <TooltipTrigger asChild type="button">
            <Button
              className="size-7.5"
              variant="secondary"
              onClick={() => setOpen(curr => !curr)}
              type="button"
            >
              <Edit className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit document</p>
          </TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="w-7xl sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Edit Document</h1>
              <p className="text-gray-600 mt-2">
                Modify and preview your accounting document before issuing
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Form Section */}
              <div className="space-y-6">
                <EditIssuedDocumentForm formData={document} updateFormData={updateFormData} />

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

                      <Button onClick={onApproveHandler} className="flex-1">
                        <Check className="w-4 h-4 mr-2" />
                        Accept Changes
                      </Button>
                    </div>

                    {totalAmount > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center font-medium text-blue-900">
                          <span>Total Document Amount:</span>
                          <span>
                            {totalAmount.toFixed(2)} {document.currency}
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
                          <p className="text-sm text-gray-400">
                            Click Preview to generate document
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Previous business documents */}
                {document.client && (
                  <RecentBusinessDocs
                    businessId={document.client?.id}
                    linkedDocumentIds={document.linkedDocumentIds ?? []}
                  />
                )}

                {/* Previous similar-types documents */}
                <RecentDocsOfSameType documentType={document.type} />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
