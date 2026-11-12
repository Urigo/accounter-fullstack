import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../../../ui/button.js';
import { ConfirmationModal } from '../confirmation-modal.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

async function renderInForm(onSubmit: () => void, onConfirm: () => void): Promise<void> {
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    root = createRoot(container);
    root.render(
      <form
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {/* No explicit `type`: inside a form this would default to a submit button. */}
        <ConfirmationModal title="Are you sure?" onConfirm={onConfirm}>
          <Button>Issue</Button>
        </ConfirmationModal>
      </form>,
    );
  });
}

function buttonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(
    b => b.textContent === text,
  );
  if (!button) {
    throw new Error(`No button "${text}"`);
  }
  return button;
}

describe('ConfirmationModal', () => {
  it('opens without submitting an enclosing form, and confirms exactly once', async () => {
    const onSubmit = vi.fn();
    const onConfirm = vi.fn();
    await renderInForm(onSubmit, onConfirm);

    await act(async () => {
      buttonByText('Issue').click();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Are you sure?');

    await act(async () => {
      buttonByText('Confirm').click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('runs `onConfirm` once for a double-click on Confirm', async () => {
    const onConfirm = vi.fn();
    await renderInForm(vi.fn(), onConfirm);

    await act(async () => {
      buttonByText('Issue').click();
    });
    // Both clicks land before React re-renders, as they can in a browser while the dialog plays
    // its exit animation with Confirm still on screen.
    await act(async () => {
      const confirm = buttonByText('Confirm');
      confirm.click();
      confirm.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('allows confirming again after the dialog is reopened', async () => {
    const onConfirm = vi.fn();
    await renderInForm(vi.fn(), onConfirm);

    for (let i = 0; i < 2; i++) {
      await act(async () => {
        buttonByText('Issue').click();
      });
      await act(async () => {
        buttonByText('Confirm').click();
      });
    }

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
