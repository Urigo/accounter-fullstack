import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChargeErrors } from '../charge-errors.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function chargeData(errors: string[], missingSecuritiesTaxCategories: string[] = []) {
  // fragment masking is type-only: the component reads the plain object
  return {
    id: 'charge-1',
    errorsLedger: { validate: { errors, missingSecuritiesTaxCategories } },
  } as never;
}

describe('ChargeErrors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (data: never) => act(() => root.render(<ChargeErrors data={data} />));
  const buttons = () => Array.from(container.querySelectorAll('button')).map(b => b.textContent);

  it('renders nothing for a valid ledger', () => {
    render(chargeData([]));

    expect(container.innerHTML).toBe('');
  });

  it('lists the ledger errors without quick-fixes when no configuration is missing', () => {
    render(chargeData(['Business "Acme" is unbalanced']));

    expect(container.textContent).toContain('Business "Acme" is unbalanced');
    expect(buttons()).toEqual([]);
  });

  it('offers to set each missing securities tax category', () => {
    render(
      chargeData(
        ['Missing securities tax category "Foreign dividend income"'],
        ['FOREIGN_DIVIDEND_INCOME', 'DIVIDEND_WITHHOLDING_TAX'],
      ),
    );

    expect(buttons()).toEqual(['Set Foreign dividend income', 'Set Dividend withholding tax']);
  });
});
