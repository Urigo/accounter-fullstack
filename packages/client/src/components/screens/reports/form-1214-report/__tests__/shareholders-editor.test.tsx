import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareholderData } from '../shareholders.js';

type SetShareholdersVariables = {
  year: number;
  shareholders: Array<{ idNumber: string; fullName: string }>;
};

const { setShareholdersMock, copyMock, hookState } = vi.hoisted(() => ({
  setShareholdersMock: vi.fn<(variables: SetShareholdersVariables) => Promise<unknown>>(),
  copyMock: vi.fn<(variables: { fromYear: number; toYear: number }) => Promise<unknown>>(),
  hookState: { saving: false },
}));

vi.mock('../../../../../hooks/use-set-shareholders.js', () => ({
  useSetShareholders: () => ({ setShareholders: setShareholdersMock, fetching: hookState.saving }),
}));
vi.mock('../../../../../hooks/use-copy-shareholders-from-year.js', () => ({
  useCopyShareholdersFromYear: () => ({ copyShareholdersFromYear: copyMock, fetching: false }),
}));
vi.mock('../../../../../hooks/use-get-businesses.js', () => ({
  useGetBusinesses: () => ({ selectableBusinesses: [], fetching: false }),
}));
vi.mock('../../../../common/index.js', () => ({
  ComboBox: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214ReportProvider } from '../report-context.js';
import { ShareholdersEditor } from '../shareholders-editor.js';

const YEAR = 2025;

function shareholder(id: string, idNumber: string, fullName: string): ShareholderData {
  return {
    id,
    idNumber,
    fullName,
    isControllingShareholder: false,
    dividendRightsPercent: 50,
    votingRightsPercent: null,
    otherRightsPercent: null,
    isMaterialShareholder: null,
    salaryMonths1To9: null,
    salaryMonths10To12: null,
    otherPayments: null,
    businessId: null,
  };
}

const SAVED = [
  shareholder('a', '000000001', 'Dana'),
  shareholder('b', '000000002', 'Yossi'),
];

let container: HTMLDivElement;
let root: Root;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function Harness({ shareholders }: { shareholders: ShareholderData[] }): ReactElement {
  return (
    <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
      <ShareholdersEditor shareholders={shareholders} />
    </Form1214ReportProvider>
  );
}

function render(shareholders: ShareholderData[]): void {
  act(() => root.render(<Harness shareholders={shareholders} />));
}

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`no "${text}" button`);
  }
  return found;
}

function queryButton(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === text,
  );
}

function inputs(labelStart: string): HTMLInputElement[] {
  return [...container.querySelectorAll('input')].filter(input =>
    input.getAttribute('aria-label')?.startsWith(labelStart),
  );
}

function type(input: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function blur(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function click(element: HTMLElement): void {
  act(() => element.click());
}

function hasText(text: string): boolean {
  return container.textContent?.includes(text) ?? false;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  refresh = vi.fn<() => void>();
  setDirty = vi.fn<(section: string, dirty: boolean) => void>();
  setShareholdersMock.mockReset();
  copyMock.mockReset();
  hookState.saving = false;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ShareholdersEditor', () => {
  it('saves the edited list, shows what the server stored and refreshes once', async () => {
    render(SAVED);
    type(inputs('Full name')[0], 'Dana Levi');
    expect(hasText('Unsaved changes')).toBe(true);
    expect(setDirty).toHaveBeenLastCalledWith('shareholders', true);

    setShareholdersMock.mockResolvedValue([
      shareholder('a2', '000000001', 'Dana Levi (stored)'),
      shareholder('b2', '000000002', 'Yossi'),
    ]);
    await act(async () => button('Save').click());

    expect(setShareholdersMock).toHaveBeenCalledTimes(1);
    const [variables] = setShareholdersMock.mock.calls[0];
    expect(variables.year).toBe(YEAR);
    expect(variables.shareholders.map(row => row.fullName)).toEqual(['Dana Levi', 'Yossi']);
    expect(inputs('Full name')[0].value).toBe('Dana Levi (stored)');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hasText('Unsaved changes')).toBe(false);
    expect(setDirty).toHaveBeenLastCalledWith('shareholders', false);
  });

  it('keeps the draft across a refreshed report, and drops what the last save returned', async () => {
    render(SAVED);
    setShareholdersMock.mockResolvedValue([shareholder('a2', '000000001', 'Stored')]);
    type(inputs('Full name')[1], 'Yossi Cohen');
    await act(async () => button('Save').click());
    expect(inputs('Full name').map(input => input.value)).toEqual(['Stored']);

    // the refreshed report is the truth now, even though it differs from what the save returned
    render([shareholder('x', '000000009', 'Refreshed')]);
    expect(inputs('Full name').map(input => input.value)).toEqual(['Refreshed']);

    // a draft survives another refresh
    type(inputs('Full name')[0], 'Draft');
    render([shareholder('x', '000000009', 'Refreshed')]);
    expect(inputs('Full name')[0].value).toBe('Draft');
    expect(hasText('Unsaved changes')).toBe(true);
  });

  it('is not dirty once an edit is reverted', () => {
    render(SAVED);
    type(inputs('Full name')[0], 'Other');
    type(inputs('Full name')[0], 'Dana');
    expect(hasText('Unsaved changes')).toBe(false);
    expect(button('Save').disabled).toBe(true);
    expect(setDirty).toHaveBeenLastCalledWith('shareholders', false);
  });

  it('cancels back to the saved rows', () => {
    render(SAVED);
    click(button('Add shareholder'));
    type(inputs('Full name')[0], 'Other');
    expect(inputs('Full name')).toHaveLength(3);
    click(button('Cancel'));
    expect(inputs('Full name').map(input => input.value)).toEqual(['Dana', 'Yossi']);
    expect(hasText('Unsaved changes')).toBe(false);
  });

  it('shows errors only once a cell is left, without flagging a fresh blank row', () => {
    render(SAVED);
    click(button('Add shareholder'));
    expect(hasText('Fix the highlighted fields')).toBe(false);

    const [, , idNumber] = inputs('ID number');
    type(idNumber, '12a');
    blur(idNumber);
    expect(hasText('ID number must be 1-9 digits')).toBe(true);
    expect(idNumber.getAttribute('aria-invalid')).toBe('true');
    const errorId = idNumber.getAttribute('aria-describedby');
    expect(errorId && document.getElementById(errorId)?.textContent).toBe(
      'ID number must be 1-9 digits',
    );
    expect(hasText('Fix the highlighted fields')).toBe(true);
  });

  it('on Save with errors, shows them all and focuses the first instead of saving', async () => {
    render(SAVED);
    click(button('Add shareholder'));
    expect(button('Save').disabled).toBe(false);

    await act(async () => button('Save').click());
    expect(setShareholdersMock).not.toHaveBeenCalled();
    expect(hasText('ID number must be 1-9 digits')).toBe(true);
    expect(hasText('Full name is required')).toBe(true);
    const [, , idNumber] = inputs('ID number');
    expect(document.activeElement).toBe(idNumber);
  });

  it('disables Save while saving', () => {
    hookState.saving = true;
    render(SAVED);
    type(inputs('Full name')[0], 'Other');
    expect(button('Saving...').disabled).toBe(true);
  });

  it('blocks more than 99 rows on Save', async () => {
    const many = Array.from({ length: 100 }, (_, index) =>
      shareholder(`s${index}`, String(index + 1), `Shareholder ${index + 1}`),
    );
    render(many);
    type(inputs('Full name')[0], 'Edited');
    expect(button('Add shareholder').disabled).toBe(true);
    expect(hasText('At most 99 shareholders; remove 1.')).toBe(true);

    await act(async () => button('Save').click());
    expect(setShareholdersMock).not.toHaveBeenCalled();
    expect((document.activeElement as HTMLElement | null)?.textContent).toBe(
      'At most 99 shareholders; remove 1.',
    );
  });

  it('blocks a repeated ID on Save, focusing it', async () => {
    render(SAVED);
    const [, second] = inputs('ID number');
    type(second, '1');
    expect(hasText('Same ID as row 1')).toBe(false);

    await act(async () => button('Save').click());
    expect(setShareholdersMock).not.toHaveBeenCalled();
    expect(hasText('Same ID as row 1')).toBe(true);
    expect(document.activeElement).toBe(second);
  });

  it('offers to copy last year only while the year is empty and clean', async () => {
    render([]);
    expect(queryButton(`Copy from ${YEAR - 1}`)).toBeDefined();

    copyMock.mockResolvedValue([]);
    await act(async () => button(`Copy from ${YEAR - 1}`).click());
    expect(copyMock).toHaveBeenCalledWith({ fromYear: YEAR - 1, toYear: YEAR });
    expect(refresh).not.toHaveBeenCalled();

    click(button('Add shareholder'));
    expect(queryButton(`Copy from ${YEAR - 1}`)).toBeUndefined();

    render(SAVED);
    click(button('Cancel'));
    expect(queryButton(`Copy from ${YEAR - 1}`)).toBeUndefined();
  });

  it('includes the name or ID in row labels once entered', () => {
    render(SAVED);
    expect(inputs('ID number, row 1 (Dana)')).toHaveLength(1);
    click(button('Add shareholder'));
    expect(inputs('ID number, row 3')[0].getAttribute('aria-label')).toBe('ID number, row 3');
  });
});
