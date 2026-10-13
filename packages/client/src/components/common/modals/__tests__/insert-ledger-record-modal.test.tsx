import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../providers/user-provider.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../ui/accordion.js';
import type { LedgerRecordFormValues } from '../../forms/ledger-record-form/schema.js';
import { InsertLedgerRecordModal } from '../insert-ledger-record-modal.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const insertLedgerRecord =
  vi.fn<(variables: Record<string, unknown>) => Promise<{ record: { id: string } } | void>>();

vi.mock('../../../../hooks/use-insert-ledger-record.js', () => ({
  useInsertLedgerRecord: () => ({ fetching: false, insertLedgerRecord }),
}));

const SUBMITTED_VALUES: LedgerRecordFormValues = {
  operation: LedgerRecordOperation.Document,
  invoiceDate: '2026-03-15',
  valueDate: '2026-03-16',
  description: 'Consulting',
  reference: '',
  debitEntity1: 'debit-entity',
  debitLocalAmount1: 117,
  creditEntity1: 'credit-entity',
  creditLocalAmount1: 117,
};

// The real form needs the entities query and pickers that happy-dom can't drive; the schema and
// mapper have their own tests. This stub submits fixed values and exposes a clickable area.
vi.mock('../../forms/ledger-record-form/index.js', () => ({
  LedgerRecordForm: ({
    onSubmit,
  }: {
    onSubmit: (values: LedgerRecordFormValues) => Promise<void>;
  }): ReactElement => (
    <div data-testid="ledger-record-form">
      <button type="button" data-testid="stub-submit" onClick={() => void onSubmit(SUBMITTED_VALUES)}>
        submit
      </button>
    </div>
  ),
}));

const userContext = {
  username: 'tester',
  context: { defaultLocalCurrency: Currency.Usd, ledgerLock: null },
} as unknown as UserInfo;

describe('InsertLedgerRecordModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onValueChange = vi.fn<(value: string[]) => void>();
  const onDone = vi.fn<() => void>();

  beforeEach(() => {
    insertLedgerRecord.mockReset();
    onValueChange.mockReset();
    onDone.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function render(): Promise<void> {
    await act(async () => {
      root.render(
        <UserContext.Provider value={{ userContext, setUserContext: () => void 0 }}>
          <Accordion type="multiple" value={[]} onValueChange={onValueChange}>
            <AccordionItem value="ledger">
              <AccordionTrigger>
                <div>
                  <InsertLedgerRecordModal chargeId="charge-1" onDone={onDone} />
                  Ledger Records
                </div>
              </AccordionTrigger>
              <AccordionContent>table</AccordionContent>
            </AccordionItem>
          </Accordion>
        </UserContext.Provider>,
      );
    });
  }

  async function click(element: Element | null): Promise<void> {
    expect(element).not.toBeNull();
    await act(async () => {
      (element as HTMLElement).click();
    });
  }

  const addButton = (): Element | null =>
    container.querySelector('button[aria-label="Add ledger record"]');
  const dialog = (): Element | null => document.querySelector('[role="dialog"]');

  it('detects accordion toggles (control)', async () => {
    await render();
    await click(container.querySelector('[data-slot="accordion-trigger"]'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('opens the dialog without toggling the accordion', async () => {
    await render();
    await click(addButton());

    expect(dialog()).not.toBeNull();
    expect(document.querySelector('[data-testid="ledger-record-form"]')).not.toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not toggle the accordion on clicks inside the portaled dialog', async () => {
    await render();
    await click(addButton());
    // Measure only the clicks inside the portal (opening is covered above)
    onValueChange.mockClear();

    await click(document.querySelector('[data-testid="ledger-record-form"]'));
    await click(document.querySelector('[data-slot="dialog-title"]'));
    await click(document.querySelector('[data-slot="dialog-overlay"]'));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('inserts the mapped record, closes the dialog and calls onDone on success', async () => {
    insertLedgerRecord.mockResolvedValue({ record: { id: 'record-1' } });
    await render();
    await click(addButton());
    await click(document.querySelector('[data-testid="stub-submit"]'));

    expect(insertLedgerRecord).toHaveBeenCalledTimes(1);
    expect(insertLedgerRecord.mock.calls[0][0]).toEqual({
      chargeId: 'charge-1',
      operation: LedgerRecordOperation.Document,
      input: expect.objectContaining({
        currency: Currency.Usd,
        debitEntity1: 'debit-entity',
        debitLocalAmount1: 117,
        creditEntity1: 'credit-entity',
        creditLocalAmount1: 117,
        debitForeignAmount1: null,
        debitEntity2: null,
        reference: null,
      }),
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps the dialog open when the server rejects the record', async () => {
    insertLedgerRecord.mockResolvedValue(undefined);
    await render();
    await click(addButton());
    await click(document.querySelector('[data-testid="stub-submit"]'));

    expect(insertLedgerRecord).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });
});
