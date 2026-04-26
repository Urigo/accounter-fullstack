import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
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
import { useInsertDynamicReportTemplate } from '../../../hooks/use-insert-dynamic-report-template.js';
import { serializeReportTree } from './template-serialization.js';
import { type CustomData, type FlatNode, type Template } from './types.js';

export interface SaveAsNewTemplateDialogRef {
  duplicateTemplate: (template: Template) => void;
  saveAsNew: () => void;
}

type Props = {
  setSelectedTemplateName: (name: string | null) => void;
  refetchAllTemplates: (opts?: { requestPolicy: 'network-only' }) => void;
  setIsDirty: (dirty: boolean) => void;
  setCurrentTemplate: (template: Template | null) => void;
  reportTree: FlatNode<CustomData>[];
};

export const SaveAsNewTemplateDialog = forwardRef<SaveAsNewTemplateDialogRef, Props>(
  function SaveAsNewTemplateDialog(
    {
      setSelectedTemplateName,
      refetchAllTemplates,
      setIsDirty,
      setCurrentTemplate,
      reportTree,
    }: Props,
    ref,
  ) {
    const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');

    const { insertDynamicReportTemplate } = useInsertDynamicReportTemplate();

    const handleDuplicateTemplate = useCallback((template: Template) => {
      setSaveAsName(`Copy of ${template.name}`);
      setSaveAsDialogOpen(true);
    }, []);

    const handleSaveAsNew = useCallback(() => {
      setSaveAsName('');
      setSaveAsDialogOpen(true);
    }, []);

    useImperativeHandle(ref, () => ({
      duplicateTemplate: handleDuplicateTemplate,
      saveAsNew: handleSaveAsNew,
    }));

    const handleSaveAsSubmit = async () => {
      if (!saveAsName.trim()) return;
      const serialized = serializeReportTree(reportTree);
      const result = await insertDynamicReportTemplate({
        name: saveAsName.trim(),
        template: serialized,
      });
      if (result) {
        setCurrentTemplate({
          id: result.id,
          name: result.name,
          lastUpdated: new Date(),
          isLocked: false,
        });
        setSelectedTemplateName(result.name);
        setIsDirty(false);
        refetchAllTemplates({ requestPolicy: 'network-only' });
      }
      setSaveAsDialogOpen(false);
      setSaveAsName('');
    };

    return (
      <Dialog open={saveAsDialogOpen} onOpenChange={setSaveAsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as New Template</DialogTitle>
            <DialogDescription>Enter a name for the new template.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="save-as-name">Template Name</Label>
            <Input
              id="save-as-name"
              value={saveAsName}
              onChange={e => setSaveAsName(e.target.value)}
              className="mt-2"
              placeholder="Enter template name..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsSubmit} disabled={!saveAsName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
