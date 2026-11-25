import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeclarationsValue } from '../profile-forms.js';

type UpdateVariables = {
  year: number;
  input: { declarations?: Record<string, unknown> | null };
  blockName: string;
};

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn<(variables: UpdateVariables) => Promise<boolean>>(),
}));

vi.mock('../../../../../hooks/use-update-report-1214-profile.js', () => ({
  useUpdateReport1214Profile: () => ({
    updateReport1214Profile: updateMock,
    fetching: false,
    errorMessage: undefined,
  }),
}));
vi.mock('../../../../common/index.js', () => ({
  DatePickerInput: ({ value }: { value?: string }) => <input aria-label="date" value={value} />,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214DeclarationsEditor } from '../declarations-editor.js';
import { Form1214ReportProvider } from '../report-context.js';

const YEAR = 2025;
const TAX_PLANNING = 'The company took a tax planning action';

let container: HTMLDivElement;
let root: Root;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function Harness({ declarations }: { declarations: DeclarationsValue | null }): ReactElement {
  return (
    <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
      <Form1214DeclarationsEditor declarations={declarations} />
    </Form1214ReportProvider>
  );
}

function render(declarations: DeclarationsValue | null): void {
  act(() => root.render(<Harness declarations={declarations} />));
}

function button(text: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === text,
  );
  if (!found) {
    throw new Error(`no "${text}" button`);
  }
  return found;
}

function answer(label: string, option: 'Yes' | 'No' | 'Not answered'): void {
  const group = container.querySelector(`[role="group"][aria-label="${label}"]`);
  if (!group) {
    throw new Error(`no "${label}" group`);
  }
  act(() => button(option, group).click());
}

function input(label: string): HTMLInputElement {
  const found = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!found) {
    throw new Error(`no "${label}" input`);
  }
  return found;
}

function type(element: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
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
  updateMock.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Form1214DeclarationsEditor', () => {
  it('starts clean, with Save disabled and a hint', () => {
    render(null);
    expect(button('Save').disabled).toBe(true);
    expect(hasText('No changes to save')).toBe(true);
    expect(setDirty).toHaveBeenLastCalledWith('declarations', false);
  });

  it('saves the whole declarations block and refreshes the report', async () => {
    render({ hadRelatedPartyTransactions: false, isKibbutz: true });
    answer(TAX_PLANNING, 'Yes');
    act(() => button('Add position').click());
    type(input('Reportable position 1'), '12');
    expect(hasText('Unsaved changes')).toBe(true);
    expect(setDirty).toHaveBeenLastCalledWith('declarations', true);

    updateMock.mockResolvedValue(true);
    await act(async () => button('Save').click());

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toEqual({
      year: YEAR,
      input: {
        declarations: {
          hasTaxPlanningAction: true,
          hadRelatedPartyTransactions: false,
          isKibbutz: true,
          reportablePositions: [12],
        },
      },
      blockName: 'declarations',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hasText('Unsaved changes')).toBe(false);
    expect(setDirty).toHaveBeenLastCalledWith('declarations', false);
  });

  it('is not dirty once an answer is reverted', () => {
    render({ hasTaxPlanningAction: false });
    answer(TAX_PLANNING, 'Yes');
    expect(setDirty).toHaveBeenLastCalledWith('declarations', true);
    answer(TAX_PLANNING, 'No');
    expect(hasText('Unsaved changes')).toBe(false);
    expect(button('Save').disabled).toBe(true);
    expect(setDirty).toHaveBeenLastCalledWith('declarations', false);
  });

  it('cancels back to the saved answers', () => {
    render({ hasTaxPlanningAction: false });
    answer(TAX_PLANNING, 'Not answered');
    act(() => button('Cancel').click());
    const group = container.querySelector(`[role="group"][aria-label="${TAX_PLANNING}"]`)!;
    expect(button('No', group).getAttribute('aria-pressed')).toBe('true');
    expect(hasText('Unsaved changes')).toBe(false);
  });

  it('does not save an invalid position, and ties the error to its input', async () => {
    render(null);
    act(() => button('Add position').click());
    type(input('Reportable position 1'), '1000');
    await act(async () => button('Save').click());

    expect(updateMock).not.toHaveBeenCalled();
    const field = input('Reportable position 1');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(
      field.getAttribute('aria-describedby')!.split(' ').at(-1)!,
    );
    expect(message?.textContent).toBe('A whole number from 1 to 999');
  });

  it('allows more positions than the form holds, with a hint', () => {
    render({ reportablePositions: [1, 2, 3, 4, 5, 6] });
    expect(hasText('The form has room for 5 positions')).toBe(true);
  });

  it('clears its dirty mark when it unmounts', () => {
    render(null);
    answer(TAX_PLANNING, 'Yes');
    act(() => root.render(<div />));
    expect(setDirty).toHaveBeenLastCalledWith('declarations', false);
  });
});
