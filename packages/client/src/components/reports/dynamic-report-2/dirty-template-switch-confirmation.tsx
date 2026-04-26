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
import { type Template } from './types.js';

type Props = {
  applyTemplate: (template: Template) => void;
  pendingTemplate: Template | null;
  setPendingTemplate: (template: Template | null) => void;
  templateSwitchDialogOpen: boolean;
  setTemplateSwitchDialogOpen: (open: boolean) => void;
};

export function DirtyTemplateSwitchConfirmation({
  applyTemplate,
  pendingTemplate,
  setPendingTemplate,
  templateSwitchDialogOpen,
  setTemplateSwitchDialogOpen,
}: Props) {
  const handleTemplateSwitchConfirm = () => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
    }
    setTemplateSwitchDialogOpen(false);
    setPendingTemplate(null);
  };

  return (
    <AlertDialog open={templateSwitchDialogOpen} onOpenChange={setTemplateSwitchDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            Loading a template will discard your unsaved changes. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setTemplateSwitchDialogOpen(false);
              setPendingTemplate(null);
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleTemplateSwitchConfirm}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
