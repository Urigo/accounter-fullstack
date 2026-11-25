import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FragmentType } from '../../../../../gql/index.js';
import type { Form1214RelatedCompaniesSectionFragmentDoc } from '../../../../../gql/graphql.js';

type UpdateVariables = {
  year: number;
  input: { relatedCompanies?: Array<{ companyName: string }> | null };
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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Form1214ReportProvider } from '../report-context.js';
import { Form1214RelatedCompaniesSection } from '../sections/related-companies-section.js';

const YEAR = 2025;

type Company = { companyName: string; companyFileNumber: string | null; relationType: string; assessingOfficeCode: number | null };

function report(
  companies: Company[],
): FragmentType<typeof Form1214RelatedCompaniesSectionFragmentDoc> {
  return {
    id: 'report',
    profile: { id: 'profile', relatedCompanies: companies },
  } as unknown as FragmentType<typeof Form1214RelatedCompaniesSectionFragmentDoc>;
}

const SAVED: Company[] = [
  { companyName: 'חברה בת', companyFileNumber: '513000000', relationType: 'SUBSIDIARY', assessingOfficeCode: 34 },
];

let container: HTMLDivElement;
let root: Root;
let refresh: ReturnType<typeof vi.fn<() => void>>;
let setDirty: ReturnType<typeof vi.fn<(section: string, dirty: boolean) => void>>;

function Harness({ companies }: { companies: Company[] }): ReactElement {
  return (
    <Form1214ReportProvider year={YEAR} refresh={refresh} setDirty={setDirty}>
      <Form1214RelatedCompaniesSection data={report(companies)} />
    </Form1214ReportProvider>
  );
}

function render(companies: Company[]): void {
  act(() => root.render(<Harness companies={companies} />));
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

function input(label: string): HTMLInputElement | null {
  return container.querySelector(`input[aria-label="${label}"]`);
}

function type(element: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function click(element: HTMLElement): void {
  act(() => element.click());
}

/** The text of the elements `aria-describedby` names (that exist). */
function describedText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ');
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

describe('Form1214RelatedCompaniesSection', () => {
  it('sends the whole list, an empty one once every company is removed', async () => {
    render(SAVED);
    click(container.querySelector<HTMLButtonElement>('[aria-label="Remove related company 1"]')!);
    expect(setDirty).toHaveBeenLastCalledWith('related-companies', true);
    updateMock.mockResolvedValue(true);
    await act(async () => button('Save').click());
    expect(updateMock.mock.calls[0][0]).toMatchObject({
      year: YEAR,
      input: { relatedCompanies: [] },
      blockName: 'related companies',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('sends edited rows as stored, trimmed', async () => {
    render(SAVED);
    type(input('Related company 1 name')!, ' New name ');
    updateMock.mockResolvedValue(true);
    await act(async () => button('Save').click());
    expect(updateMock.mock.calls[0][0].input).toEqual({
      relatedCompanies: [
        {
          companyName: 'New name',
          companyFileNumber: '513000000',
          relationType: 'SUBSIDIARY',
          assessingOfficeCode: 34,
        },
      ],
    });
  });

  it('refuses to save a new row without a name or relation, naming both fields', async () => {
    render(SAVED);
    click(button('Add company'));
    await act(async () => button('Save').click());
    expect(updateMock).not.toHaveBeenCalled();
    const name = input('Related company 2 name')!;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(name)).toContain('Enter the company name');
    const relation = container.querySelector<HTMLElement>(
      '[aria-label="Related company 2 relation"]',
    )!;
    expect(describedText(relation)).toContain('Choose the relation type');
  });
});
