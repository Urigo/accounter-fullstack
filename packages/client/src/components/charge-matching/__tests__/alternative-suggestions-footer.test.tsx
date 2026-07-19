// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AlternativeSuggestionsFooter,
  type FooterSuggestion,
} from '../alternative-suggestions-footer.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const SUGGESTIONS: FooterSuggestion[] = [
  { chargeId: 'match-1', confidenceScore: 0.94, label: 'Acme Ltd' },
  { chargeId: 'match-2', confidenceScore: 0.71, label: 'Globex Corp' },
  { chargeId: 'match-3', confidenceScore: 0.52, label: 'Initech' },
];

async function renderFooter(props: React.ComponentProps<typeof AlternativeSuggestionsFooter>) {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(AlternativeSuggestionsFooter, props));
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

describe('AlternativeSuggestionsFooter', () => {
  it('renders a ranked button per suggestion with its relative score', async () => {
    const { container, cleanup } = await renderFooter({
      suggestions: SUGGESTIONS,
      selectedIndex: 0,
      onSelect: vi.fn(),
    });

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toContain('#1');
    expect(buttons[0].textContent).toContain('Acme Ltd');
    expect(buttons[0].textContent).toContain('94%');
    expect(buttons[2].textContent).toContain('#3');
    expect(buttons[2].textContent).toContain('52%');

    await cleanup();
  });

  it('marks the selected suggestion and reports clicks with the suggestion index', async () => {
    const onSelect = vi.fn();
    const { container, cleanup } = await renderFooter({
      suggestions: SUGGESTIONS,
      selectedIndex: 1,
      onSelect,
    });

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      buttons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(onSelect).toHaveBeenCalledWith(2);

    await cleanup();
  });

  it('renders nothing when there are no alternatives beyond the top match', async () => {
    const { container, cleanup } = await renderFooter({
      suggestions: SUGGESTIONS.slice(0, 1),
      selectedIndex: 0,
      onSelect: vi.fn(),
    });

    expect(container.querySelectorAll('button')).toHaveLength(0);

    await cleanup();
  });
});
