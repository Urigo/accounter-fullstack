import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettlementAccountSuggestion } from '../settlement-account-suggestion.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('SettlementAccountSuggestion', () => {
  it('names the bank account and its linked debits, and fills the picker on "Use"', () => {
    const onUse = vi.fn<(bankAccountId: string) => void>();
    act(() =>
      root.render(
        <SettlementAccountSuggestion
          suggestion={{ id: 'bank-1', name: 'Main account', number: '123456', linksCount: 3 }}
          onUse={onUse}
        />,
      ),
    );

    expect(container.textContent).toContain('Suggested: Main account (123456) (3 linked debits)');
    const use = [...container.querySelectorAll('button')].find(node => node.textContent === 'Use');
    expect(use).toBeDefined();
    act(() => {
      use!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onUse).toHaveBeenCalledWith('bank-1');
  });

  it('shows the number alone when the account has no other name', () => {
    act(() =>
      root.render(
        <SettlementAccountSuggestion
          suggestion={{ id: 'bank-1', name: '123456', number: '123456', linksCount: 2 }}
          onUse={() => {}}
        />,
      ),
    );
    expect(container.textContent).toContain('Suggested: 123456 (2 linked debits)');
  });
});
