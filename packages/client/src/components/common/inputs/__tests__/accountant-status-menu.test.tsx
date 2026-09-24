// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import { AccountantStatusMenu } from '../accountant-status-menu.js';

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
  document.body.innerHTML = '';
});

function render(ui: Parameters<Root['render']>[0]): void {
  act(() => root.render(ui));
}

function trigger(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('[data-accountant-status-trigger]');
  if (!button) {
    throw new Error('status trigger not rendered');
  }
  return button;
}

/** Radix opens the menu on a primary-button pointerdown, then renders the items in a portal. */
function openMenu(): void {
  act(() => {
    trigger().dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
    );
  });
}

function menuItems(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

function selectItem(label: string): void {
  const item = menuItems().find(el => el.textContent?.trim() === label);
  if (!item) {
    throw new Error(`menu item "${label}" not found`);
  }
  act(() => {
    item.click();
  });
}

const LABELS: Array<[string, AccountantStatus]> = [
  ['Approved', AccountantStatus.Approved],
  ['Pending', AccountantStatus.Pending],
  ['Unapproved', AccountantStatus.Unapproved],
];

describe('AccountantStatusMenu', () => {
  it.each(LABELS)('calls onChange with %s', (label, status) => {
    const onChange = vi.fn();
    render(<AccountantStatusMenu value={AccountantStatus.Unapproved} onChange={onChange} />);
    openMenu();
    expect(menuItems()).toHaveLength(3);
    selectItem(label);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(status);
  });

  it('does nothing when disabled', () => {
    const onChange = vi.fn();
    render(<AccountantStatusMenu value={AccountantStatus.Approved} onChange={onChange} disabled />);
    expect(trigger().disabled).toBe(true);
    openMenu();
    expect(menuItems()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('labels the trigger with the current status', () => {
    render(<AccountantStatusMenu value={AccountantStatus.Pending} onChange={vi.fn()} />);
    expect(trigger().getAttribute('aria-label')).toBe('Pending');
  });

  it('renders a neutral placeholder when the value is null', () => {
    const onChange = vi.fn();
    render(<AccountantStatusMenu value={null} onChange={onChange} />);
    expect(trigger().getAttribute('aria-label')).toBe('No status');
    openMenu();
    selectItem('Approved');
    expect(onChange).toHaveBeenCalledWith(AccountantStatus.Approved);
  });

  it('still renders the trigger when wrapped in a tooltip', () => {
    const onChange = vi.fn();
    render(
      <AccountantStatusMenu
        value={AccountantStatus.Approved}
        onChange={onChange}
        tooltip="Approved by Dana"
        disabled
      />,
    );
    expect(trigger().disabled).toBe(true);
    // the disabled button swallows pointer events, so the tooltip needs its own trigger around it
    expect(trigger().parentElement?.getAttribute('data-slot')).toBe('tooltip-trigger');
  });
});
