import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Accordion, AccordionContent, AccordionItem } from '../../ui/accordion.js';
import { LedgerSectionHeader } from '../ledger-section-header.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../hooks/use-insert-ledger-record.js', () => ({
  useInsertLedgerRecord: () => ({ fetching: false, insertLedgerRecord: vi.fn() }),
}));
vi.mock('../../../hooks/use-regenerate-ledger-records.js', () => ({
  useRegenerateLedgerRecords: () => ({
    fetching: false,
    regenerateLedgerRecords: vi.fn(() => Promise.resolve()),
  }),
}));
// The form is stubbed so the dialog renders without the entities query; this suite is about where
// clicks go, not about the form.
vi.mock('../../common/forms/ledger-record-form/index.js', () => ({
  LedgerRecordForm: (): ReactElement => (
    <div data-testid="ledger-record-form">
      <input aria-label="stub field" />
    </div>
  ),
}));

describe('LedgerSectionHeader', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onValueChange = vi.fn<(value: string[]) => void>();

  beforeEach(() => {
    onValueChange.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function render(isLedgerLocked = false): Promise<void> {
    await act(async () => {
      root.render(
        <Accordion type="multiple" value={[]} onValueChange={onValueChange}>
          <AccordionItem value="ledger">
            <LedgerSectionHeader
              chargeId="charge-1"
              isLedgerLocked={isLedgerLocked}
              onChange={() => void 0}
            />
            <AccordionContent>table</AccordionContent>
          </AccordionItem>
        </Accordion>,
      );
    });
  }

  async function click(element: Element | null): Promise<void> {
    expect(element).not.toBeNull();
    await act(async () => {
      (element as HTMLElement).click();
    });
  }

  const trigger = (): Element | null => container.querySelector('[data-slot="accordion-trigger"]');
  const addButton = (): Element | null =>
    container.querySelector('button[aria-label="Add ledger record"]');
  const dialog = (): Element | null => document.querySelector('[role="dialog"]');

  it('toggles the section from the trigger (control)', async () => {
    await render();
    await click(trigger());
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('renders the actions beside the trigger, not inside it', async () => {
    await render();
    expect(trigger()?.textContent).toContain('Ledger Records');
    expect(trigger()?.querySelector('button')).toBeNull();
    expect(addButton()).not.toBeNull();
    expect(addButton()?.closest('[data-slot="accordion-trigger"]')).toBeNull();
  });

  it('hides both actions when the ledger is locked', async () => {
    await render(true);
    expect(addButton()).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(trigger()).not.toBeNull();
  });

  it('opening the insert dialog and clicking inside it does not toggle the section', async () => {
    await render();
    await click(addButton());
    expect(dialog()).not.toBeNull();

    await click(document.querySelector('[data-testid="ledger-record-form"]'));
    await click(document.querySelector('[aria-label="stub field"]'));
    await click(document.querySelector('[data-slot="dialog-title"]'));
    await click(document.querySelector('[data-slot="dialog-overlay"]'));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('opening the regenerate confirmation and cancelling it does not toggle the section', async () => {
    await render();
    await click(container.querySelector('svg.lucide-refresh-ccw-dot')?.closest('button') ?? null);
    expect(dialog()).not.toBeNull();

    const cancel = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
      button => button.textContent === 'Cancel',
    );
    await click(cancel ?? null);

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
