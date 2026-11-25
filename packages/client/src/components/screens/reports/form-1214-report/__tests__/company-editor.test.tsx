import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyOverridesValue, PreparerValue } from '../profile-forms.js';

type UpdateVariables = {
  year: number;
  input: Record<string, unknown>;
};

const { updateMock, hookState } = vi.hoisted(() => ({
  updateMock: vi.fn<(variables: UpdateVariables, blockName: string) => Promise<boolean>>(),
  hookState: { saving: false },
}));

vi.mock('../../../../../hooks/use-update-report-1214-profile.js', () => ({
  useUpdateReport1214Profile: () => ({
    updateReport1214Profile: updateMock,
    fetching: hookState.saving,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214CompanyEditor, Form1214PreparerEditor } from '../company-editor.js';
import { Form1214ReportProvider } from '../report-context.js';

const YEAR = 2025;

let container: HTMLDivElement;
let root: Root;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function renderCompany(company: CompanyOverridesValue | null): void {
  act(() =>
    root.render(
      <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
        <Form1214CompanyEditor company={company} />
      </Form1214ReportProvider>,
    ),
  );
}

function renderPreparer(preparer: PreparerValue | null): void {
  act(() =>
    root.render(
      <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
        <Form1214PreparerEditor preparer={preparer} />
      </Form1214ReportProvider>,
    ),
  );
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

/** The input a `<label>` with this text points at, or one with this `aria-label`. */
function field(label: string): HTMLInputElement {
  const byAria = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (byAria) {
    return byAria as HTMLInputElement;
  }
  const labelElement = [...container.querySelectorAll('label')].find(
    candidate => candidate.textContent?.trim() === label,
  );
  const found = labelElement && document.getElementById(labelElement.htmlFor);
  if (!found) {
    throw new Error(`no "${label}" field`);
  }
  return found as HTMLInputElement;
}

function errorOf(element: HTMLElement): string | undefined {
  const ids = element.getAttribute('aria-describedby')?.split(' ') ?? [];
  return ids
    .map(id => document.getElementById(id)?.textContent)
    .find(text => !!text);
}

function type(element: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function save(): Promise<void> {
  await act(async () => button('Save').click());
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
  hookState.saving = false;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Form1214CompanyEditor', () => {
  it('flags a phone without a prefix and a number that is not 7 digits, and does not save', async () => {
    renderCompany(null);
    type(field('Phone number'), '123');
    await save();

    expect(updateMock).not.toHaveBeenCalled();
    expect(field('Phone prefix').getAttribute('aria-invalid')).toBe('true');
    expect(errorOf(field('Phone prefix'))).toBe('Choose a prefix');
    expect(errorOf(field('Phone number'))).toBe('Exactly 7 digits');
  });

  it('flags only the number when the stored prefix is kept', async () => {
    renderCompany({ phone: { prefix: '03', number: '1234567' } });
    type(field('Phone number'), '12345678');
    await save();

    expect(updateMock).not.toHaveBeenCalled();
    expect(field('Phone prefix').getAttribute('aria-invalid')).toBe('false');
    expect(errorOf(field('Phone number'))).toBe('Exactly 7 digits');
  });

  it('sends null when every override is cleared, then refreshes', async () => {
    renderCompany({ registeredName: 'Acme' });
    type(field('Registered name'), '');
    updateMock.mockResolvedValue(true);
    await save();

    expect(updateMock.mock.calls).toEqual([[{ year: YEAR, input: { company: null } }, 'company details']]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hasText('Unsaved changes')).toBe(false);
  });

  it('stays dirty and does not refresh when the save fails', async () => {
    renderCompany(null);
    type(field('Email'), 'office@example.com');
    updateMock.mockResolvedValue(false);
    await save();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(hasText('Unsaved changes')).toBe(true);
    expect(field('Email').value).toBe('office@example.com');
    expect(setDirty).toHaveBeenLastCalledWith('company', true);
  });

  it('follows new stored values while clean, keeps a draft while dirty, and follows them again after a save', async () => {
    renderCompany({ registeredName: 'A' });
    renderCompany({ registeredName: 'B' });
    expect(field('Registered name').value).toBe('B');

    type(field('Registered name'), 'Draft');
    renderCompany({ registeredName: 'C' });
    expect(field('Registered name').value).toBe('Draft');
    expect(hasText('Unsaved changes')).toBe(true);

    updateMock.mockResolvedValue(true);
    await save();
    expect(field('Registered name').value).toBe('Draft');
    expect(hasText('Unsaved changes')).toBe(false);

    // the refreshed block (as the server stored it) replaces what was sent
    renderCompany({ registeredName: 'Draft (stored)' });
    expect(field('Registered name').value).toBe('Draft (stored)');
  });

  it('disables the fields while a save is in flight', () => {
    hookState.saving = true;
    renderCompany(null);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(button('Saving…').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
  });
});

describe('Form1214PreparerEditor', () => {
  it('sends null when every field is cleared', async () => {
    renderPreparer({ officeName: 'Office', profession: 'CPA' });
    type(field('Office name'), '');
    type(field('Profession'), '');
    updateMock.mockResolvedValue(true);
    await save();

    expect(updateMock.mock.calls).toEqual([
      [{ year: YEAR, input: { preparer: null } }, 'preparer details'],
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('flags a licensed dealer number that is not up to 9 digits', async () => {
    renderPreparer(null);
    type(field('Licensed dealer number'), '1234567890');
    await save();

    expect(updateMock).not.toHaveBeenCalled();
    expect(errorOf(field('Licensed dealer number'))).toBe('Up to 9 digits');
  });

  it('flags the phone number of a preparer', async () => {
    renderPreparer({ phone: { prefix: '02', number: '7654321' } });
    type(field('Phone number'), '76');
    await save();

    expect(updateMock).not.toHaveBeenCalled();
    expect(errorOf(field('Phone number'))).toBe('Exactly 7 digits');
  });
});
