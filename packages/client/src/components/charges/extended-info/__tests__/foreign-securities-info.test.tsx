import { act, type ComponentProps, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForeignSecuritiesInfo } from '../foreign-securities-info.js';

/**
 * The descriptor badges read their fields through `getFragmentData`, which asserts on the
 * fragment document at runtime. A stub that prints the ISIN (and the business's locality) keeps
 * these cases about the panel while still showing which branch rendered the badges.
 */
vi.mock('../../../securities/security-descriptor-badges.js', () => ({
  SecurityDescriptorBadges: ({ security }: { security: { isin: string; isForeign?: boolean } }) => (
    <span data-testid="descriptor-badges">
      {security.isin}
      {security.isForeign && ' Foreign'}
    </span>
  ),
}));

type ChargeProps = ComponentProps<typeof ForeignSecuritiesInfo>['chargeProps'];

const SECURITY_KEY = '1000001';
const BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

const details = {
  id: 'details-1',
  engName: 'Example Bond 5% 01/30',
  hebName: 'אג"ח לדוגמה',
  symbol: 'EX0130',
  itemType: 'Bond',
  stockType: null,
  exchange: 'LUX',
  currencyCode: 'USD',
  isEtf: false,
  // the bank's raw flag, set on local securities too; the panel must not read it
  isForeign: true,
  asOfDate: '2026-01-15',
};

const securityBusiness = {
  id: BUSINESS_ID,
  isin: 'XS0000000001',
  symbol: 'EX0130',
  engName: 'Example Bond 5% 01/30',
  hebName: null,
};

function charge(security: {
  details: typeof details | null;
  securityBusiness:
    | (Omit<typeof securityBusiness, 'engName'> & {
        engName: string | null;
        isForeign?: boolean | null;
      })
    | null;
}): ChargeProps {
  return {
    id: 'charge-1',
    __typename: 'ForeignSecuritiesCharge',
    counterparty: security.securityBusiness ? { id: security.securityBusiness.id } : null,
    counterparties: security.securityBusiness ? [{ id: security.securityBusiness.id }] : [],
    securities: [
      {
        id: `charge-1-${SECURITY_KEY}`,
        securityKey: SECURITY_KEY,
        executions: [],
        isOffsetting: false,
        netAmount: { raw: -1000, formatted: '$ -1,000.00' },
        ...security,
      },
    ],
  } as unknown as ChargeProps;
}

const OTHER_KEY = '2000002';
const OTHER_BUSINESS_ID = '00000000-0000-0000-0000-000000000002';

/** A second security in the same charge, known only by its business */
const otherSecurity = (overrides: { isOffsetting: boolean; raw: number; formatted: string }) => ({
  id: `charge-1-${OTHER_KEY}`,
  securityKey: OTHER_KEY,
  executions: [],
  details: null,
  securityBusiness: {
    id: OTHER_BUSINESS_ID,
    isin: 'XS0000000002',
    symbol: 'EX0230',
    engName: 'Example Fund Two',
    hebName: null,
  },
  isOffsetting: overrides.isOffsetting,
  netAmount: { raw: overrides.raw, formatted: overrides.formatted },
});

/** The charge from `charge()` with a second security and the given counterparty outcome */
function twoSecurities(
  counterparty: { id: string } | null,
  counterparties: Array<{ id: string }>,
  other: ReturnType<typeof otherSecurity>,
): ChargeProps {
  const base = charge({ details, securityBusiness }) as unknown as {
    securities: unknown[];
  };
  return {
    ...base,
    counterparty,
    counterparties,
    securities: [other, ...base.securities],
  } as unknown as ChargeProps;
}

/** The heading renders a `Link`, so the panel needs a router around it. */
function Harness({ chargeProps }: { chargeProps: ChargeProps }): ReactElement {
  return (
    <RouterProvider
      router={createMemoryRouter([
        { path: '/', element: <ForeignSecuritiesInfo chargeProps={chargeProps} /> },
      ])}
    />
  );
}

describe('ForeignSecuritiesInfo', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (chargeProps: ChargeProps) =>
    act(() => root.render(<Harness chargeProps={chargeProps} />));

  const securityLink = () => container.querySelector('a');

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the reference details, with the ISIN and a link to the Security tab', () => {
    render(charge({ details, securityBusiness }));

    expect(container.textContent).toContain('Example Bond 5% 01/30');
    expect(container.textContent).toContain('XS0000000001');
    expect(container.textContent).toContain('reference data as of');
    expect(securityLink()?.getAttribute('href')).toBe(`/businesses/${BUSINESS_ID}?tab=security`);
  });

  it('falls back to the security business when there is no reference row', () => {
    render(charge({ details: null, securityBusiness }));

    expect(container.textContent).toContain('Example Bond 5% 01/30');
    expect(container.querySelector('[data-testid="descriptor-badges"]')?.textContent).toBe(
      'XS0000000001',
    );
    expect(securityLink()?.getAttribute('href')).toBe(`/businesses/${BUSINESS_ID}?tab=security`);
    expect(container.textContent).not.toContain('No reference data');
  });

  it('takes locality from the security business, not the raw reference flag', () => {
    render(charge({ details, securityBusiness: { ...securityBusiness, isForeign: false } }));

    expect(container.querySelector('[data-testid="descriptor-badges"]')?.textContent).toBe(
      'XS0000000001',
    );
    expect(container.textContent).not.toContain('Foreign');
  });

  it('marks a security its business judges foreign', () => {
    render(charge({ details, securityBusiness: { ...securityBusiness, isForeign: true } }));

    expect(container.textContent).toContain('Foreign');
  });

  it('shows no locality without a security business', () => {
    render(charge({ details, securityBusiness: null }));

    expect(container.textContent).toContain('USD');
    expect(container.textContent).not.toContain('Foreign');
  });

  it('names a business with no English name by its ISIN', () => {
    render(charge({ details: null, securityBusiness: { ...securityBusiness, engName: null } }));

    expect(securityLink()?.textContent).toBe('XS0000000001');
  });

  it('says nothing is known when neither source has the key', () => {
    render(charge({ details: null, securityBusiness: null }));

    expect(container.textContent).toContain(`Security ${SECURITY_KEY}`);
    expect(container.textContent).toContain(
      'No reference data or security business for this key yet',
    );
    expect(securityLink()).toBeNull();
  });

  it('shows the net amount but no role badge for a charge of a single security', () => {
    render(charge({ details, securityBusiness }));

    expect(container.textContent).toContain('$ -1,000.00');
    expect(container.textContent).not.toContain('Main counterparty');
    expect(container.textContent).not.toContain('spans');
  });

  it('marks the counterparty and lists a security that nets to zero last', () => {
    render(
      twoSecurities(
        { id: BUSINESS_ID },
        [{ id: BUSINESS_ID }],
        otherSecurity({ isOffsetting: true, raw: 0, formatted: '$ 0.00' }),
      ),
    );

    const text = container.textContent ?? '';
    expect(text).toContain('Main counterparty');
    expect(text).toContain('Nets to zero');
    expect(text).not.toContain('spans');
    // the counterparty comes first, although the offsetting security was listed first
    expect(text.indexOf('Example Bond 5% 01/30')).toBeLessThan(text.indexOf('Example Fund Two'));
  });

  it('says a charge spanning several securities has no single counterparty', () => {
    render(
      twoSecurities(
        null,
        [{ id: BUSINESS_ID }, { id: OTHER_BUSINESS_ID }],
        otherSecurity({ isOffsetting: false, raw: 1000, formatted: '$ 1,000.00' }),
      ),
    );

    const text = container.textContent ?? '';
    expect(text).toContain('This charge spans 2 securities');
    expect(text).toContain('Counterparty 1 of 2');
    expect(text).toContain('Counterparty 2 of 2');
    expect(text).not.toContain('Main counterparty');
  });

  it('renders nothing for a charge that is not a foreign-securities charge', () => {
    render({ id: 'charge-1', __typename: 'CommonCharge' } as unknown as ChargeProps);

    expect(container.textContent).toBe('');
  });
});
