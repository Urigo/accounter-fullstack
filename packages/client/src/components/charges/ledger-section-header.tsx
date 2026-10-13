import type { ReactElement } from 'react';
import { InsertLedgerRecordModal, RegenerateLedgerRecordsButton } from '../common/index.js';
import { AccordionTrigger } from '../ui/accordion.js';

type Props = {
  chargeId: string;
  isLedgerLocked: boolean;
  /** Called after the charge's ledger records changed, to refresh the charge */
  onChange: () => void;
};

/**
 * Header row of a charge's ledger accordion section. The actions sit beside the trigger rather than
 * inside it, so they are not buttons nested in the trigger's `<button>`, and neither their clicks
 * nor anything their dialogs render toggles the section.
 */
export function LedgerSectionHeader({ chargeId, isLedgerLocked, onChange }: Props): ReactElement {
  return (
    <div className="flex flex-row items-center">
      {!isLedgerLocked && (
        <div className="flex flex-row items-center gap-2 pl-4">
          <RegenerateLedgerRecordsButton
            chargeId={chargeId}
            onChange={onChange}
            variant="outline"
          />
          <InsertLedgerRecordModal chargeId={chargeId} onDone={onChange} />
        </div>
      )}
      <div className="flex-1">
        <AccordionTrigger
          className={isLedgerLocked ? undefined : 'ml-2'}
          onClick={event => {
            event.stopPropagation();
          }}
        >
          Ledger Records
        </AccordionTrigger>
      </div>
    </div>
  );
}
