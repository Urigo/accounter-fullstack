import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { useUpdateDynamicReportTemplateName } from '../../../hooks/use-update-dynamic-report-template-name.js';
import { type Template } from './types.js';

export interface RenameTemplateDialogRef {
  renameTemplate: () => void;
}

type Props = {
  setSelectedTemplateName: (name: string) => void;
  refetchAllTemplates: (opts?: { requestPolicy: 'network-only' }) => void;
  currentTemplate: Template | null;
  setCurrentTemplate: Dispatch<SetStateAction<Template | null>>;
};

export const RenameTemplateDialog = forwardRef<RenameTemplateDialogRef, Props>(
  function RenameTemplateDialog(
    { setSelectedTemplateName, refetchAllTemplates, currentTemplate, setCurrentTemplate }: Props,
    ref,
  ) {
    const [templateRenameDialogOpen, setTemplateRenameDialogOpen] = useState(false);
    const [templateRenameValue, setTemplateRenameValue] = useState('');

    const { updateDynamicReportTemplateName } = useUpdateDynamicReportTemplateName();

    const handleRenameTemplate = useCallback(() => {
      if (!currentTemplate) return;
      setTemplateRenameValue(currentTemplate.name);
      setTemplateRenameDialogOpen(true);
    }, [currentTemplate]);

    useImperativeHandle(ref, () => ({
      renameTemplate: handleRenameTemplate,
    }));

    const handleRenameTemplateSubmit = async () => {
      if (!currentTemplate || !templateRenameValue.trim()) return;
      const result = await updateDynamicReportTemplateName({
        name: currentTemplate.name,
        newName: templateRenameValue.trim(),
      });
      if (result) {
        setCurrentTemplate((prev: Template | null) =>
          prev ? ({ ...prev, id: result.id, name: result.name } as Template) : null,
        );
        setSelectedTemplateName(result.name);
        refetchAllTemplates({ requestPolicy: 'network-only' });
      }
      setTemplateRenameDialogOpen(false);
      setTemplateRenameValue('');
    };

    return (
      <Dialog open={templateRenameDialogOpen} onOpenChange={setTemplateRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Template</DialogTitle>
            <DialogDescription>Enter a new name for this template.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="template-rename-input">Name</Label>
            <Input
              id="template-rename-input"
              value={templateRenameValue}
              onChange={e => setTemplateRenameValue(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameTemplateSubmit} disabled={!templateRenameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
