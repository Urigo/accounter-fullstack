import type { ReactElement, ReactNode } from 'react';
import { Languages } from 'lucide-react';
import { Direction } from 'radix-ui';
import { Button } from '../../ui/button.js';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { useLedgerFormLang } from '../forms/ledger-record-form/i18n.js';

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

/**
 * The body of a ledger record dialog, laid out in the form's language: right-to-left for Hebrew,
 * which mirrors the header, the form's grid and lines, and the overlays (selects, entity pickers)
 * opened from it. A small button in its top corner, beside the close (×), swaps the language.
 */
export function LedgerRecordDialogContent({ title, description, children }: Props): ReactElement {
  const { dir, strings, toggleLang } = useLedgerFormLang();

  return (
    <DialogContent dir={dir} className="max-h-screen overflow-y-auto sm:max-w-2xl">
      <Direction.Provider dir={dir}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleLang}
          aria-label={strings.switchLanguageLabel}
          title={strings.switchLanguageLabel}
          className="absolute top-2.5 end-10 h-7 gap-1 px-1.5 text-xs text-muted-foreground"
        >
          <Languages className="size-3.5" />
          {strings.switchLanguageText}
        </Button>
        {/* Start-aligned rather than the header's default left, so it follows the direction; the
            end padding keeps the title clear of the corner buttons */}
        <DialogHeader className="sm:text-start pe-16">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </Direction.Provider>
    </DialogContent>
  );
}
