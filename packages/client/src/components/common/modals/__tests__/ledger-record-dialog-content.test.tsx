import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../../../ui/dialog.js';
import { LedgerRecordForm } from '../../forms/ledger-record-form/index.js';
import { LedgerRecordDialogContent } from '../ledger-record-dialog-content.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeClient(): Client {
  const payload = JSON.stringify({ data: { allFinancialEntities: { nodes: [] } } });
  const mockFetch = (async () =>
    ({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => payload,
      json: async () => JSON.parse(payload),
    }) as unknown as Response) as unknown as typeof fetch;
  return new Client({ url: 'http://localhost/graphql', exchanges: [fetchExchange], fetch: mockFetch });
}

const STORAGE_KEY = 'accounter-ledger-record-form-lang';

function TestDialog({ title }: { title: string }): React.ReactElement {
  return (
    <Dialog open>
      <LedgerRecordDialogContent title={title} description="description">
        <LedgerRecordForm mode="insert" submitting={false} onSubmit={vi.fn()} />
      </LedgerRecordDialogContent>
    </Dialog>
  );
}

describe('LedgerRecordDialogContent', () => {
  let container: HTMLDivElement;
  let root: Root;

  async function render(element: React.ReactElement): Promise<void> {
    await act(async () => {
      root.render(<Provider value={makeClient()}>{element}</Provider>);
    });
  }

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  const dialogs = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
  const dialog = (): HTMLElement => dialogs()[0]!;
  const labels = (scope: Element = dialog()): string[] =>
    Array.from(scope.querySelectorAll('label')).map(label => label.textContent ?? '');
  const toggle = (scope: Element = dialog()): HTMLButtonElement =>
    scope.querySelector<HTMLButtonElement>(
      'button[aria-label="Switch to Hebrew"], button[aria-label="החלפה לאנגלית"]',
    )!;
  const formMessages = (): Array<string | null> =>
    Array.from(dialog().querySelectorAll('[data-slot="form-message"]')).map(
      element => element.textContent,
    );

  async function click(element: HTMLElement): Promise<void> {
    await act(async () => {
      element.click();
    });
  }

  async function submit(): Promise<void> {
    await act(async () => {
      dialog()
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  }

  it('opens in English, left to right, with a corner button that switches to Hebrew', async () => {
    await render(<TestDialog title="Add ledger record" />);

    expect(dialog().getAttribute('dir')).toBe('ltr');
    expect(labels()).toEqual(
      expect.arrayContaining(['Operation', 'Currency', 'Invoice date', 'Debit', 'Credit 2']),
    );
    expect(toggle().getAttribute('aria-label')).toBe('Switch to Hebrew');
    expect(toggle().textContent).toBe('עב');
    // Beside the close (×), at the end corner in either direction
    expect(toggle().className).toContain('end-10');
    expect(dialog().querySelector('[data-slot="dialog-close"]')?.className).toContain('end-4');
  });

  it('swaps the form to Hebrew, right to left, and back', async () => {
    await render(<TestDialog title="הוספת רשומת יומן" />);

    await click(toggle());

    expect(dialog().getAttribute('dir')).toBe('rtl');
    expect(labels()).toEqual(
      expect.arrayContaining(['פעולה', 'מטבע', 'תאריך חשבונית', 'תאריך ערך', 'חובה', 'זכות 2']),
    );
    expect(dialog().querySelector('button[type="submit"]')?.textContent).toBe('הוספת רשומה');
    expect(dialog().textContent).toContain('סה״כ חובה');
    expect(toggle().getAttribute('aria-label')).toBe('החלפה לאנגלית');
    expect(toggle().textContent).toBe('EN');

    await click(toggle());

    expect(dialog().getAttribute('dir')).toBe('ltr');
    expect(labels()).toEqual(expect.arrayContaining(['Operation', 'Debit']));
  });

  it('remembers the choice for the next dialog', async () => {
    await render(<TestDialog title="first" />);
    await click(toggle());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('he');

    await act(async () => root.unmount());
    root = createRoot(container);
    await render(<TestDialog title="second" />);

    expect(dialog().getAttribute('dir')).toBe('rtl');
    expect(labels()).toContain('חובה');
  });

  it('shows validation messages in the chosen language, and translates shown ones on a switch', async () => {
    await render(<TestDialog title="title" />);
    await click(toggle());

    await submit();
    expect(formMessages()).toEqual(expect.arrayContaining(['יש לבחור פעולה', 'יש לבחור ישות']));

    await click(toggle());
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(formMessages()).toEqual(
      expect.arrayContaining(['Operation is required', 'Entity is required']),
    );
    expect(formMessages()).not.toContain('יש לבחור פעולה');
  });

  it('switches every open ledger record dialog together', async () => {
    await render(
      <>
        <TestDialog title="first" />
        <TestDialog title="second" />
      </>,
    );
    expect(dialogs()).toHaveLength(2);

    await click(toggle(dialogs()[0]));

    for (const element of dialogs()) {
      expect(element.getAttribute('dir')).toBe('rtl');
      expect(labels(element)).toContain('חובה');
    }
  });
});
