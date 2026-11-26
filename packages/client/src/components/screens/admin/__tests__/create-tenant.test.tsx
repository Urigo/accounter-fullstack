import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../../router/routes.js';
import { CreateTenantScreen, invitationLinkFor } from '../create-tenant.js';

const { bootstrapNewClientMock, sessionViewerState, writeTextMock } = vi.hoisted(() => ({
  bootstrapNewClientMock: vi.fn(),
  sessionViewerState: {
    fetching: false,
    viewer: { isSuperAdmin: true } as { isSuperAdmin: boolean } | null,
  },
  writeTextMock: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock('../../../../hooks/use-bootstrap-new-client.js', () => ({
  useBootstrapNewClient: () => ({
    fetching: false,
    error: undefined,
    bootstrapNewClient: bootstrapNewClientMock,
  }),
}));

vi.mock('../../../../hooks/use-viewer.js', () => ({
  useSessionViewer: () => ({
    fetching: sessionViewerState.fetching,
    error: undefined,
    viewer: sessionViewerState.viewer,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Sets a React-controlled input's value the way typing would. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function inputByPlaceholder(container: HTMLElement, placeholder: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`);
  if (!input) {
    throw new Error(`No input with placeholder ${placeholder}`);
  }
  return input;
}

async function settle(): Promise<void> {
  // react-hook-form validates and submits asynchronously.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

describe('CreateTenantScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionViewerState.fetching = false;
    sessionViewerState.viewer = { isSuperAdmin: true };
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(): Promise<void> {
    await act(async () => {
      root.render(<CreateTenantScreen />);
      await settle();
    });
  }

  async function fillAndSubmit(values: {
    businessName?: string;
    ownerEmail?: string;
    year?: string;
  }): Promise<void> {
    await act(async () => {
      if (values.businessName !== undefined) {
        typeInto(inputByPlaceholder(container, 'Example Ltd.'), values.businessName);
      }
      if (values.ownerEmail !== undefined) {
        typeInto(inputByPlaceholder(container, 'owner@example.com'), values.ownerEmail);
      }
      if (values.year !== undefined) {
        typeInto(
          inputByPlaceholder(container, String(new Date().getFullYear())),
          values.year,
        );
      }
      await settle();
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    });
  }

  it('refuses the form to a caller who is not a super-admin', async () => {
    sessionViewerState.viewer = { isSuperAdmin: false };
    await render();

    expect(container.textContent).toContain('Super-admin access required');
    expect(container.querySelector('form')).toBeNull();
  });

  it('creates the tenant and shows the invitation link with a copy button', async () => {
    bootstrapNewClientMock.mockResolvedValue({
      id: 'business-1',
      invitationToken: 'secret-token',
      business: { id: 'business-1', name: 'Example Ltd.' },
    });
    await render();

    await fillAndSubmit({
      businessName: '  Example Ltd. ',
      ownerEmail: 'Owner@Example.com',
      year: '2025',
    });

    expect(bootstrapNewClientMock).toHaveBeenCalledWith({
      input: {
        businessName: 'Example Ltd.',
        countryCode: 'ISR',
        ownerEmail: 'owner@example.com',
        ownerRole: 'business_owner',
        dateEstablished: undefined,
        initialAccounterYear: 2025,
      },
    });

    const expectedLink = `${window.location.origin}${ROUTES.ACCEPT_INVITATION('secret-token')}`;
    const linkInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Invitation link"]',
    );
    expect(linkInput?.value).toBe(expectedLink);
    expect(container.textContent).toContain('owner@example.com');
    expect(container.textContent).toContain('Accounter does not email it');

    const copyButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Copy link'),
    );
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
    });
    expect(writeTextMock).toHaveBeenCalledWith(expectedLink);
  });

  it('does not submit an invalid form', async () => {
    await render();

    await fillAndSubmit({ businessName: '', ownerEmail: 'not-an-email', year: '20' });

    expect(bootstrapNewClientMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Business name is required');
    expect(container.textContent).toContain('Please enter a valid email address');
  });

  it('keeps the form when the mutation fails', async () => {
    bootstrapNewClientMock.mockResolvedValue(undefined);
    await render();

    await fillAndSubmit({ businessName: 'Example Ltd.', ownerEmail: 'owner@example.com' });

    expect(bootstrapNewClientMock).toHaveBeenCalledOnce();
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector('input[aria-label="Invitation link"]')).toBeNull();
  });
});

describe('invitationLinkFor', () => {
  it('builds the accept-invitation URL on the given origin', () => {
    expect(invitationLinkFor('abc', 'https://app.example.com')).toBe(
      'https://app.example.com/accept-invitation/abc',
    );
  });
});
