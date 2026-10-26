import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Environment } from '../../../shared/types/index.js';

const { destroyMock } = vi.hoisted(() => ({ destroyMock: vi.fn() }));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { destroy: destroyMock, upload: vi.fn() } },
}));

const { CloudinaryProvider } = await import('../cloudinary.js');

describe('CloudinaryProvider.deleteUpload', () => {
  const provider = new CloudinaryProvider({} as Environment);

  beforeEach(() => {
    destroyMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('deletes under the given resource type', async () => {
    destroyMock.mockResolvedValue({ result: 'ok' });

    await provider.deleteUpload('invoices/abc', 'raw');

    expect(destroyMock).toHaveBeenCalledWith('invoices/abc', { resource_type: 'raw' });
  });

  it('fails when Cloudinary deleted nothing', async () => {
    destroyMock.mockResolvedValue({ result: 'not found' });

    const error = (await provider.deleteUpload('invoices/abc', 'image').catch(e => e)) as Error;

    expect(error.message).toBe('Error on deleting file [invoices/abc] from cloudinary');
    expect((error.cause as Error).message).toBe('Cloudinary responded "not found"');
  });

  it('wraps the plain-object rejection of the SDK in an Error', async () => {
    destroyMock.mockRejectedValue({ message: 'Invalid signature', http_code: 401 });

    const error = await provider.deleteUpload('invoices/abc', 'image').catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toEqual({ message: 'Invalid signature', http_code: 401 });
  });
});
