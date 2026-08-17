// @vitest-environment happy-dom

import React, { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Currency, LedgerValidationStatus, MissingChargeInfo } from '../../../gql/graphql.js';
import {
  amountState,
  AmountText,
  CountChip,
  ledgerState,
  NeedsBadge,
  StatusDot,
  vatState,
} from '../charge-indicators.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, cleanup };
}

describe('ledgerState', () => {
  it('reads an absent (still deferred) value as pending rather than fine', () => {
    // `metadata.invalidLedger` arrives in a later @defer patch; treating undefined as VALID would
    // flash a healthy ledger before the real answer lands.
    expect(ledgerState(undefined)).toBe('pending');
  });

  it.each([
    [LedgerValidationStatus.Valid, 'ok'],
    [LedgerValidationStatus.Diff, 'warning'],
    [LedgerValidationStatus.Invalid, 'error'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(ledgerState(status)).toBe(expected);
  });
});

describe('amountState', () => {
  it('is ok for the ten types that do not validate their amount', () => {
    expect(amountState(false, undefined)).toBe('ok');
    // Even a stale `false` must not raise an error on a type that never validates.
    expect(amountState(false, false)).toBe('ok');
  });

  it('is pending until CreditcardBankCharge validity arrives, then reflects it', () => {
    expect(amountState(true, undefined)).toBe('pending');
    expect(amountState(true, true)).toBe('ok');
    expect(amountState(true, false)).toBe('error');
  });
});

describe('vatState', () => {
  const base = { value: 180, currency: Currency.Ils, amountValue: 1180, isMissingInfo: false };

  it('is ok for a consistent VAT', () => {
    expect(vatState(base)).toBe('ok');
  });

  it('flags a missing VAT on a local-currency charge', () => {
    expect(vatState({ ...base, value: undefined })).toBe('error');
  });

  it('does not flag an absent VAT on a foreign-currency charge', () => {
    expect(vatState({ ...base, value: undefined, currency: Currency.Usd })).toBe('ok');
  });

  it('flags a VAT whose sign disagrees with the charge amount', () => {
    expect(vatState({ ...base, value: 180, amountValue: -1180 })).toBe('error');
    expect(vatState({ ...base, value: -180, amountValue: 1180 })).toBe('error');
  });

  it('flags server-reported missing VAT regardless of the local checks', () => {
    expect(vatState({ ...base, isMissingInfo: true })).toBe('error');
  });
});

describe('StatusDot', () => {
  it('renders nothing when healthy, so a complete record stays visually quiet', async () => {
    const { container, cleanup } = await render(<StatusDot state="ok" />);
    expect(container.innerHTML).toBe('');
    await cleanup();
  });

  it.each(['pending', 'warning', 'error'] as const)('renders a dot for %s', async state => {
    const { container, cleanup } = await render(<StatusDot state={state} />);
    expect(container.querySelector('span')).not.toBeNull();
    await cleanup();
  });
});

describe('CountChip', () => {
  it('names the count for assistive tech without repeating a state when healthy', async () => {
    const { container, cleanup } = await render(<CountChip label="ledger" count={4} />);
    const chip = container.querySelector('[aria-label]');
    expect(chip?.getAttribute('aria-label')).toBe('ledger 4');
    expect(container.textContent).toContain('4');
    await cleanup();
  });

  it('puts the state in the accessible name, so it is not conveyed by color alone', async () => {
    const { container, cleanup } = await render(
      <CountChip label="ledger" count={4} state="warning" />,
    );
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'ledger 4, has differences',
    );
    await cleanup();
  });

  it('still names a zero count', async () => {
    const { container, cleanup } = await render(
      <CountChip label="documents" count={0} state="error" />,
    );
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'documents 0, has issues',
    );
    await cleanup();
  });
});

describe('NeedsBadge', () => {
  it('renders nothing for a complete charge', async () => {
    const { container, cleanup } = await render(<NeedsBadge type="CommonCharge" missingInfo={[]} />);
    expect(container.innerHTML).toBe('');
    await cleanup();
  });

  it('renders nothing when validationData never arrived', async () => {
    const { container, cleanup } = await render(
      <NeedsBadge type="CommonCharge" missingInfo={undefined} />,
    );
    expect(container.innerHTML).toBe('');
    await cleanup();
  });

  it('counts the missing info and names each item', async () => {
    const { container, cleanup } = await render(
      <NeedsBadge
        type="CommonCharge"
        missingInfo={[MissingChargeInfo.Description, MissingChargeInfo.Tags]}
      />,
    );
    expect(container.textContent).toContain('2');
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      '2 details missing: description, tags',
    );
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
      'Missing: description, tags',
    );
    await cleanup();
  });

  it('does not count missing info the charge type has nowhere to show', async () => {
    // A SalaryCharge hides both counterparty and VAT, so a badge here would point at fields the
    // user cannot see, let alone fix.
    const { container, cleanup } = await render(
      <NeedsBadge
        type="SalaryCharge"
        missingInfo={[MissingChargeInfo.Counterparty, MissingChargeInfo.Vat]}
      />,
    );
    expect(container.innerHTML).toBe('');
    await cleanup();
  });

  it('counts only the displayable subset when the two are mixed', async () => {
    const { container, cleanup } = await render(
      <NeedsBadge
        type="SalaryCharge"
        missingInfo={[MissingChargeInfo.Vat, MissingChargeInfo.Description]}
      />,
    );
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      '1 detail missing: description',
    );
    await cleanup();
  });
});

describe('AmountText', () => {
  it('colors income and expense differently and keeps digits tabular', async () => {
    const income = await render(<AmountText value={1180} currency={Currency.Ils} />);
    const incomeClass = income.container.querySelector('span')?.className ?? '';
    expect(incomeClass).toContain('text-emerald-700');
    expect(incomeClass).toContain('dark:text-emerald-400');
    expect(incomeClass).toContain('tabular-nums');
    await income.cleanup();

    const expense = await render(<AmountText value={-1180} currency={Currency.Ils} />);
    const expenseClass = expense.container.querySelector('span')?.className ?? '';
    expect(expenseClass).toContain('text-red-600');
    expect(expenseClass).toContain('dark:text-red-400');
    await expense.cleanup();
  });

  it('formats with the charge currency', async () => {
    const { container, cleanup } = await render(
      <AmountText value={-1180} currency={Currency.Ils} />,
    );
    expect(container.textContent).toContain('1,180');
    await cleanup();
  });
});
