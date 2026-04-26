import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
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
import { useDeleteDynamicReportTemplate } from '../../../../hooks/use-delete-dynamic-report-template.js';
import { type Template } from '../utils/types.js';

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

    const { deleteDynamicReportTemplate } = useDeleteDynamicReportTemplate();

    const handleDeleteTemplate = useCallback((template: Template) => {
      setTemplateToDelete(template);
      setDeleteTemplateDialogOpen(true);
    }, []);

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
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action
              cannot be undone.
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
