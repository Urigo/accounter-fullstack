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
    securities: [
      {
        id: `charge-1-${SECURITY_KEY}`,
        securityKey: SECURITY_KEY,
        executions: [],
        ...security,
      },
    ],
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

  it('renders nothing for a charge that is not a foreign-securities charge', () => {
    render({ id: 'charge-1', __typename: 'CommonCharge' } as unknown as ChargeProps);

    expect(container.textContent).toBe('');
  });
});
