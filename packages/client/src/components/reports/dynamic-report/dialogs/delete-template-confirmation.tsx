import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useClient } from 'urql';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';
import { DynamicReportThreadsDocument } from '../../../../gql/graphql.js';
import { useDeleteDynamicReportTemplate } from '../../../../hooks/use-delete-dynamic-report-template.js';
import { type Template } from '../utils/types.js';

function threadsLabel(count: number): string {
  return count === 1 ? 'Its discussion thread' : `Its ${count} discussion threads`;
}

export interface DeleteTemplateConfirmationRef {
  deleteTemplate: (template: Template) => void;
}

type Props = {
  setSelectedTemplateName: (name: string | null) => void;
  refetchAllTemplates: (opts?: { requestPolicy: 'network-only' }) => void;
  currentTemplate: Template | null;
  setCurrentTemplate: (template: Template | null) => void;
};

export const DeleteTemplateConfirmation = forwardRef<DeleteTemplateConfirmationRef, Props>(
  function DeleteTemplateConfirmation(
    { setSelectedTemplateName, refetchAllTemplates, currentTemplate, setCurrentTemplate }: Props,
    ref,
  ) {
    const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    // How many comment threads go with the template, or null while unknown (loading, or the
    // lookup failed — the dialog then just doesn't mention them).
    const [threadCount, setThreadCount] = useState<number | null>(null);
    const countRequest = useRef(0);

    const { deleteDynamicReportTemplate } = useDeleteDynamicReportTemplate();
    const client = useClient();

    const handleDeleteTemplate = useCallback(
      (template: Template) => {
        setTemplateToDelete(template);
        setThreadCount(null);
        setDeleteTemplateDialogOpen(true);
        // The template may not be the one on screen (the manager deletes any), so its threads are
        // looked up here rather than taken from the comments layer.
        const request = ++countRequest.current;
        client
          .query(
            DynamicReportThreadsDocument,
            { templateName: template.name },
            { requestPolicy: 'network-only' },
          )
          .toPromise()
          .then(({ data, error }) => {
            if (request !== countRequest.current || error || !data) return;
            setThreadCount(data.dynamicReportThreads.length);
          })
          .catch(() => {
            // No count is fine: the dialog reads as it did before threads existed.
          });
      },
      [client],
    );

    useImperativeHandle(ref, () => ({
      deleteTemplate: handleDeleteTemplate,
    }));

    const handleDeleteTemplateConfirm = async () => {
      if (!templateToDelete) return;
      const result = await deleteDynamicReportTemplate({ name: templateToDelete.name });
      if (result && templateToDelete.id === currentTemplate?.id) {
        setCurrentTemplate(null);
        setSelectedTemplateName(null);
      }
      if (result) {
        refetchAllTemplates({ requestPolicy: 'network-only' });
      }
      setDeleteTemplateDialogOpen(false);
      setTemplateToDelete(null);
    };

    return (
      <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;?
              {threadCount ? (
                <span data-thread-count={threadCount}>
                  {` ${threadsLabel(threadCount)} will be deleted with it.`}
                </span>
              ) : null}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplateConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
);
