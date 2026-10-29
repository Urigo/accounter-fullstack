import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsraeliCorporationLookupQuery } from '../../../gql/graphql.js';
import { IsraeliCorporationLookup, type RegistryFormFields } from '../israeli-corporation-lookup.js';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
}));

type QueryArgs = { variables: { corporationNumber: string }; pause: boolean };

const guild: NonNullable<IsraeliCorporationLookupQuery['israeliCorporation']> = {
  id: '516232675',
  name: 'הגילדה למוצרי תוכנה בע"מ',
  englishName: 'SOFTWARE PRODUCTS GUILDA LTD',
  status: 'פעילה',
  subStatus: null,
  corporationType: 'ישראלית',
  contactType: 'חברה',
  limitType: 'מוגבלת',
  purpose: 'לעסוק בכל עיסוק חוקי',
  registrationDate: '2020-08-02',
  lastAnnualReport: 2025,
  isGovernmental: false,
  violations: null,
  address: {
    street: 'הדקלים',
    houseNumber: '2',
    city: 'כפר קאסם',
    zipCode: '4881000',
    country: 'ישראל',
  },
};

function queryResult(result: {
  data?: IsraeliCorporationLookupQuery;
  fetching?: boolean;
  error?: Error;
}) {
  return [{ fetching: false, ...result }, vi.fn()];
}

function lastQueryArgs(): QueryArgs {
  return useQueryMock.mock.calls.at(-1)?.[0] as QueryArgs;
}

describe('IsraeliCorporationLookup', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue(queryResult({}));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function render(govId: string, onApply?: (fields: RegistryFormFields) => void) {
    act(() => {
      root.render(<IsraeliCorporationLookup govId={govId} onApply={onApply} />);
    });
  }

  it('renders nothing while the number is still being typed', () => {
    render('51623');
    expect(container.textContent).toBe('');
    expect(lastQueryArgs().pause).toBe(true);
  });

  it('flags a wrong check digit without querying the registry', () => {
    render('516232676');
    expect(container.textContent).toContain("check digit doesn't match");
    expect(lastQueryArgs().pause).toBe(true);
  });

  it('flags non-digits and overlong numbers', () => {
    render('51623267a');
    expect(container.textContent).toContain('digits only');
    render('5162326750');
    expect(container.textContent).toContain('9 digits');
  });

  it('shows the company the registry found', () => {
    useQueryMock.mockReturnValue(queryResult({ data: { israeliCorporation: guild } }));
    render('51-623267-5');

    expect(lastQueryArgs()).toMatchObject({
      variables: { corporationNumber: '516232675' },
      pause: false,
    });
    const text = container.textContent;
    expect(text).toContain('הגילדה למוצרי תוכנה בע"מ');
    expect(text).toContain('SOFTWARE PRODUCTS GUILDA LTD');
    expect(text).toContain('פעילה');
    expect(text).toContain('02/08/2020');
    expect(text).toContain('הדקלים 2, כפר קאסם 4881000');
  });

  it('fills the form from the registry', () => {
    useQueryMock.mockReturnValue(queryResult({ data: { israeliCorporation: guild } }));
    const onApply = vi.fn<(fields: RegistryFormFields) => void>();
    render('516232675', onApply);

    const button = [...container.querySelectorAll('button')].find(candidate =>
      candidate.textContent?.includes('Fill empty fields'),
    );
    act(() => button?.click());

    expect(onApply).toHaveBeenCalledWith({
      localName: 'הגילדה למוצרי תוכנה בע"מ',
      address: 'הדקלים 2',
      city: 'כפר קאסם',
      zipCode: '4881000',
    });
  });

  it('offers no fill button without onApply', () => {
    useQueryMock.mockReturnValue(queryResult({ data: { israeliCorporation: guild } }));
    render('516232675');
    expect(container.textContent).not.toContain('Fill empty fields');
  });

  it('says so when the registry does not list the number', () => {
    useQueryMock.mockReturnValue(queryResult({ data: { israeliCorporation: null } }));
    render('516232675');
    expect(container.textContent).toContain('No company with this number');
  });

  it('says so when the registry could not be reached', () => {
    useQueryMock.mockReturnValue(queryResult({ error: new Error('upstream down') }));
    render('516232675');
    expect(container.textContent).toContain("Couldn't reach the Israeli Corporations Registry");
  });

  it('debounces a changed number and hides the previous result meanwhile', () => {
    vi.useFakeTimers();
    useQueryMock.mockReturnValue(queryResult({ data: { israeliCorporation: guild } }));
    render('516232675');

    // urql keeps the previous data while the next lookup is pending
    render('520018078');
    expect(lastQueryArgs().pause).toBe(true);
    expect(container.textContent).toContain('Checking the Israeli Corporations Registry');
    expect(container.textContent).not.toContain('הגילדה');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(lastQueryArgs()).toMatchObject({
      variables: { corporationNumber: '520018078' },
      pause: false,
    });
  });
});
