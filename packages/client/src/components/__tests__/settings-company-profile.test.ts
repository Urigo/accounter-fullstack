// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useWorkspaceMock, refetchMock } = vi.hoisted(() => ({
  useWorkspaceMock: vi.fn(),
  refetchMock: vi.fn(),
}));

const { useMutationMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
}));

vi.mock('../../providers/workspace-provider.js', () => ({
  useWorkspace: useWorkspaceMock,
}));

vi.mock('urql', () => ({
  useMutation: useMutationMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CompanyProfile } from '../screens/settings/company-profile.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeMutateFn(result: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue({ data: result, error: undefined });
}

function setupMocks(
  workspace: Record<string, unknown> | null,
  opts: { mutationFetching?: boolean } = {},
) {
  useWorkspaceMock.mockReturnValue({
    workspace,
    isLoading: false,
    error: null,
    refetch: refetchMock,
  });

  // useMutation is called 3 times per render in order: UPDATE_WORKSPACE, UPLOAD_LOGO, REMOVE_LOGO
  // Use a cycling counter so re-renders work
  const updateFn = makeMutateFn({ updateWorkspaceSettings: workspace ?? {} });
  const uploadFn = makeMutateFn({ uploadWorkspaceLogo: workspace ?? {} });
  const removeFn = makeMutateFn({ removeWorkspaceLogo: workspace ?? {} });

  const fns = [
    [{ fetching: opts.mutationFetching ?? false }, updateFn],
    [{ fetching: false }, uploadFn],
    [{ fetching: false }, removeFn],
  ];
  let callIdx = 0;
  useMutationMock.mockImplementation(() => {
    const ret = fns[callIdx % fns.length];
    callIdx++;
    return ret;
  });

  return { updateFn, uploadFn, removeFn };
}

async function render() {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(CompanyProfile));
    await Promise.resolve();
  });

  const html = container.innerHTML;
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, html, cleanup };
}

describe('CompanyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when workspace is loading', async () => {
    useWorkspaceMock.mockReturnValue({
      workspace: null,
      isLoading: true,
      error: null,
      refetch: refetchMock,
    });
    const noop = vi.fn().mockResolvedValue({ data: {}, error: undefined });
    useMutationMock.mockReturnValue([{ fetching: false }, noop]);

    const { html, cleanup } = await render();
    expect(html).toContain('animate-spin');
    await cleanup();
  });

  it('renders form with workspace data', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      companyName: 'Test Corp',
      logoUrl: 'https://example.com/logo.png',
    });

    const { container, cleanup } = await render();
    const nameInput = container.querySelector('#companyName') as HTMLInputElement;
    const logoInput = container.querySelector('#logoUrl') as HTMLInputElement;

    expect(nameInput?.value).toBe('Test Corp');
    expect(logoInput?.value).toBe('https://example.com/logo.png');
    await cleanup();
  });

  it('renders empty form when no workspace exists', async () => {
    setupMocks(null);

    const { container, cleanup } = await render();
    const nameInput = container.querySelector('#companyName') as HTMLInputElement;
    expect(nameInput.value).toBe('');
    await cleanup();
  });

  it('shows logo preview when URL is set', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      companyName: 'Test',
      logoUrl: 'https://example.com/logo.png',
    });

    const { html, cleanup } = await render();
    expect(html).toContain('https://example.com/logo.png');
    await cleanup();
  });

  it('shows fallback building icon when no logo URL', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      companyName: 'Test',
      logoUrl: null,
    });

    const { html, cleanup } = await render();
    expect(html).toContain('svg');
    await cleanup();
  });

  it('shows upload and URL input controls', async () => {
    setupMocks({ id: '1', ownerId: 'o1', companyName: 'Test', logoUrl: null });

    const { html, cleanup } = await render();
    expect(html).toContain('Upload logo');
    expect(html).toContain('Logo URL');
    expect(html).toContain('Company Name');
    await cleanup();
  });

  it('shows Replace and Remove when logo exists', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      companyName: 'Test',
      logoUrl: 'https://example.com/logo.png',
    });

    const { html, cleanup } = await render();
    expect(html).toContain('Replace');
    expect(html).toContain('Remove');
    await cleanup();
  });

  it('shows file size/type hint', async () => {
    setupMocks({ id: '1', ownerId: 'o1', companyName: 'Test', logoUrl: null });

    const { html, cleanup } = await render();
    expect(html).toContain('2 MB');
    expect(html).toContain('256x256');
    await cleanup();
  });

  it('save button is disabled when form is not dirty', async () => {
    setupMocks({ id: '1', ownerId: 'o1', companyName: 'Test', logoUrl: null });

    const { container, cleanup } = await render();
    // Find the Save Profile button specifically
    const buttons = Array.from(container.querySelectorAll('button'));
    const saveBtn = buttons.find(b => b.textContent?.includes('Save'));
    expect(saveBtn?.disabled).toBe(true);
    await cleanup();
  });

  it('save button enables after changing company name', async () => {
    setupMocks({ id: '1', ownerId: 'o1', companyName: 'Test', logoUrl: null });

    const { container, cleanup } = await render();
    const nameInput = container.querySelector('#companyName') as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(nameInput, 'New Name');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const saveBtn = buttons.find(b => b.textContent?.includes('Save'));
    expect(saveBtn?.disabled).toBe(false);
    await cleanup();
  });

  it('calls update mutation on save', async () => {
    const { updateFn } = setupMocks({
      id: '1',
      ownerId: 'o1',
      companyName: 'Test',
      logoUrl: null,
    });

    const { container, cleanup } = await render();
    const nameInput = container.querySelector('#companyName') as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(nameInput, 'Updated Name');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const saveBtn = buttons.find(b => b.textContent?.includes('Save')) as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
      await Promise.resolve();
    });

    expect(updateFn).toHaveBeenCalledWith({
      input: { companyName: 'Updated Name', logoUrl: null },
    });
    await cleanup();
  });

  it('does not expose Cloudinary secrets in rendered HTML', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      companyName: 'Test Corp',
      logoUrl: 'https://res.cloudinary.com/test/logo.png',
    });

    const { html, cleanup } = await render();
    expect(html).not.toContain('CLOUDINARY_API_KEY');
    expect(html).not.toContain('CLOUDINARY_API_SECRET');
    expect(html).not.toContain('api_secret');
    await cleanup();
  });

  it('shows required asterisk on Company Name', async () => {
    setupMocks(null);

    const { html, cleanup } = await render();
    expect(html).toContain('Company Name');
    expect(html).toContain('*');
    await cleanup();
  });

  it('accepts file input with image accept attribute', async () => {
    setupMocks({ id: '1', ownerId: 'o1', companyName: 'Test', logoUrl: null });

    const { container, cleanup } = await render();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toContain('image/');
    await cleanup();
  });

  it('file input is hidden (upload triggered via button)', async () => {
    setupMocks({ id: '1', ownerId: 'o1', companyName: 'Test', logoUrl: null });

    const { container, cleanup } = await render();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.className).toContain('hidden');
    await cleanup();
  });
});
