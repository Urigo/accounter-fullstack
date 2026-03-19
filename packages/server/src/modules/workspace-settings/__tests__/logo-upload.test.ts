import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cloudinary before the provider module loads
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';

const mockUpload = vi.mocked(cloudinary.uploader.upload);

const mockEnvWithCloudinary = {
  cloudinary: {
    name: 'test-cloud',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
  },
  postgres: {} as never,
  greenInvoice: undefined,
  authorization: { users: undefined, adminBusinessId: 'admin-id' },
  hive: undefined,
  googleDrive: undefined,
  deel: undefined,
  gmail: undefined,
  auth0: undefined,
  general: { frontendUrl: undefined, settingsEncryptionKey: undefined },
};

const mockEnvWithoutCloudinary = {
  ...mockEnvWithCloudinary,
  cloudinary: undefined,
};

async function makeProvider(env: typeof mockEnvWithCloudinary) {
  const mockDb = {
    query: vi.fn(),
  };

  const mockAuth = {
    getAuthContext: vi.fn().mockResolvedValue({
      tenant: { businessId: 'owner-123' },
    }),
  };

  const { WorkspaceSettingsProvider } = await import(
    '../providers/workspace-settings.provider.js'
  );

  const provider = new WorkspaceSettingsProvider(
    mockDb as never,
    mockAuth as never,
    env as never,
  );

  return { provider, mockDb };
}

describe('WorkspaceSettingsProvider.uploadLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when Cloudinary is not configured', async () => {
    const { provider } = await makeProvider(mockEnvWithoutCloudinary as never);
    await expect(provider.uploadLogo('base64data', 'image/png')).rejects.toThrow(
      'Cloudinary is not configured',
    );
  });

  it('throws for unsupported file type: PDF', async () => {
    const { provider } = await makeProvider(mockEnvWithCloudinary);
    await expect(provider.uploadLogo('base64data', 'application/pdf')).rejects.toThrow(
      'Unsupported file type',
    );
  });

  it('throws for all non-image MIME types', async () => {
    const { provider } = await makeProvider(mockEnvWithCloudinary);
    for (const badType of ['text/plain', 'video/mp4', 'application/zip']) {
      await expect(provider.uploadLogo('data', badType)).rejects.toThrow('Unsupported file type');
    }
  });

  it('accepts all valid image MIME types', async () => {
    const row = {
      id: '1',
      owner_id: 'owner-123',
      logo_url: 'https://res.cloudinary.com/test/logo.png',
      company_name: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockUpload.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/logo.png',
      url: 'http://res.cloudinary.com/test/logo.png',
      public_id: 'workspace-logos/owner-123/logo',
    } as never);

    for (const validType of [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]) {
      const { provider, mockDb } = await makeProvider(mockEnvWithCloudinary);
      mockDb.query.mockResolvedValue({ rows: [row] });
      await expect(provider.uploadLogo('base64data', validType)).resolves.toBeTruthy();
    }
  });

  it('uploads to workspace-specific folder', async () => {
    const row = {
      id: '1',
      owner_id: 'owner-123',
      logo_url: 'https://res.cloudinary.com/test/logo.png',
      company_name: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockUpload.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/logo.png',
      url: 'http://res.cloudinary.com/test/logo.png',
      public_id: 'workspace-logos/owner-123/logo',
    } as never);

    const { provider, mockDb } = await makeProvider(mockEnvWithCloudinary);
    mockDb.query.mockResolvedValue({ rows: [row] });

    await provider.uploadLogo('base64data', 'image/png');

    expect(mockUpload).toHaveBeenCalledWith(
      'data:image/png;base64,base64data',
      expect.objectContaining({
        folder: 'workspace-logos/owner-123',
        public_id: 'logo',
        resource_type: 'image',
      }),
    );
  });

  it('saves the secure_url returned by Cloudinary to the DB', async () => {
    const cloudinaryUrl =
      'https://res.cloudinary.com/test/image/upload/workspace-logos/logo.png';
    const row = {
      id: '1',
      owner_id: 'owner-123',
      logo_url: cloudinaryUrl,
      company_name: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockUpload.mockResolvedValue({
      secure_url: cloudinaryUrl,
      url: 'http://res.cloudinary.com/test/logo.png',
      public_id: 'workspace-logos/owner-123/logo',
    } as never);

    const { provider, mockDb } = await makeProvider(mockEnvWithCloudinary);
    mockDb.query.mockResolvedValue({ rows: [row] });

    const result = await provider.uploadLogo('base64data', 'image/jpeg');
    expect(result.logo_url).toBe(cloudinaryUrl);

    // Verify the DB upsert was called with the Cloudinary URL
    const dbArgs = mockDb.query.mock.calls[0][1] as string[];
    expect(dbArgs).toContain(cloudinaryUrl);
  });

  it('does not expose Cloudinary API secret in error messages', async () => {
    const { provider } = await makeProvider(mockEnvWithCloudinary);

    try {
      await provider.uploadLogo('data', 'application/json');
      // Should have thrown
    } catch (e) {
      const msg = String(e);
      expect(msg).not.toContain('test-api-secret');
      expect(msg).not.toContain('test-api-key');
    }
  });

  it('Cloudinary config is called with env credentials (secrets server-side only)', async () => {
    const row = {
      id: '1',
      owner_id: 'owner-123',
      logo_url: 'https://res.cloudinary.com/test/logo.png',
      company_name: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockUpload.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/logo.png',
    } as never);

    const { provider, mockDb } = await makeProvider(mockEnvWithCloudinary);
    mockDb.query.mockResolvedValue({ rows: [row] });

    await provider.uploadLogo('base64data', 'image/png');

    expect(cloudinary.config).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: 'test-cloud',
        api_key: 'test-api-key',
        api_secret: 'test-api-secret',
        secure: true,
      }),
    );
  });
});

describe('WorkspaceSettingsProvider.removeLogo', () => {
  it('sets logo_url to NULL in the database', async () => {
    const row = {
      id: '1',
      owner_id: 'owner-123',
      logo_url: null,
      company_name: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const { provider, mockDb } = await makeProvider(mockEnvWithCloudinary);
    mockDb.query.mockResolvedValue({ rows: [row] });

    const result = await provider.removeLogo();

    expect(result.logo_url).toBeNull();
    const sql = (mockDb.query.mock.calls[0][0] as string).toLowerCase();
    expect(sql).toContain('null');
  });
});
