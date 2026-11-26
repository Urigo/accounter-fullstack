import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Form1214RelatedCompaniesSectionFragmentDoc } from '../../../../../gql/graphql.js';
import type { FragmentType } from '../../../../../gql/index.js';
import { Form1214ReportProvider } from '../report-context.js';
import { Form1214RelatedCompaniesSection } from '../sections/related-companies-section.js';
import {
  buttonByText,
  byLabel,
  clickAndSettle,
  clickOn,
  describedText,
  mountRoot,
  typeInto,
} from './editor-test-dom.js';

type UpdateVariables = {
  year: number;
  input: { relatedCompanies?: Array<{ companyName: string }> | null };
};

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn<(variables: UpdateVariables, blockName: string) => Promise<boolean>>(),
}));

vi.mock('../../../../../hooks/use-update-report-1214-profile.js', () => ({
  useUpdateReport1214Profile: () => ({ updateReport1214Profile: updateMock, fetching: false }),
}));

const YEAR = 2025;

type Company = {
  companyName: string;
  companyFileNumber: string | null;
  relationType: string;
  assessingOfficeCode: number | null;
};

function report(
  companies: Company[],
): FragmentType<typeof Form1214RelatedCompaniesSectionFragmentDoc> {
  return {
    id: 'report',
    profile: { id: 'profile', relatedCompanies: companies },
  } as unknown as FragmentType<typeof Form1214RelatedCompaniesSectionFragmentDoc>;
}

const SAVED: Company[] = [
  {
    companyName: 'חברה בת',
    companyFileNumber: '513000000',
    relationType: 'SUBSIDIARY',
    assessingOfficeCode: 34,
  },
];

let mounted: ReturnType<typeof mountRoot>;
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
  act(() => mounted.root.render(<Harness companies={companies} />));
}

const container = (): HTMLDivElement => mounted.container;
const input = (label: string): HTMLInputElement | null => byLabel(container(), label);
const button = (text: string): HTMLButtonElement => buttonByText(container(), text);

beforeEach(() => {
  mounted = mountRoot();
  refresh = vi.fn<() => void>();
  setDirty = vi.fn<(section: string, dirty: boolean) => void>();
  updateMock.mockReset();
});

afterEach(() => {
  mounted.unmount();
});

describe('Form1214RelatedCompaniesSection', () => {
  it('sends the whole list, an empty one once every company is removed', async () => {
    render(SAVED);
    clickOn(byLabel<HTMLButtonElement>(container(), 'Remove related company 1')!);
    expect(setDirty).toHaveBeenLastCalledWith('related-companies', true);
    expect(document.activeElement).toBe(button('Add company'));

    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));
    expect(updateMock).toHaveBeenCalledWith(
      { year: YEAR, input: { relatedCompanies: [] } },
      'related companies',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('sends edited rows as stored, trimmed', async () => {
    render(SAVED);
    typeInto(input('Related company 1 name')!, ' New name ');
    updateMock.mockResolvedValue(true);
    await clickAndSettle(button('Save'));
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
    clickOn(button('Add company'));
    await clickAndSettle(button('Save'));
    expect(updateMock).not.toHaveBeenCalled();
    const name = input('Related company 2 name')!;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(name)).toContain('Enter the company name');
    const relation = byLabel<HTMLElement>(container(), 'Related company 2 relation')!;
    expect(describedText(relation)).toContain('Choose the relation type');
  });

  it('focuses the relation Select when it is the first invalid field on Save', async () => {
    render(SAVED);
    clickOn(button('Add company'));
    typeInto(input('Related company 2 name')!, 'Partner Ltd');
    await clickAndSettle(button('Save'));
    expect(updateMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      byLabel<HTMLElement>(container(), 'Related company 2 relation'),
    );
  });
});
