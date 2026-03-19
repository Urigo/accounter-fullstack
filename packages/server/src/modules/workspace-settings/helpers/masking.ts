export interface CredentialFieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'id';
  required: boolean;
  placeholder?: string;
}

export interface MaskedCredentialField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  hasValue: boolean;
  maskedValue: string | null;
  placeholder: string | null;
}

const PROVIDER_FIELDS: Record<string, CredentialFieldDef[]> = {
  hapoalim: [
    { key: 'userCode', label: 'User Code', type: 'text', required: true, placeholder: 'e.g. BG98920' },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  mizrahi: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  discount: [
    { key: 'id', label: 'ID Number', type: 'id', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'code', label: 'Code', type: 'text', required: false },
  ],
  leumi: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  isracard: [
    { key: 'id', label: 'ID Number', type: 'id', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'last6Digits', label: 'Last 6 Digits', type: 'text', required: true, placeholder: 'e.g. 123456' },
  ],
  amex: [
    { key: 'id', label: 'ID Number', type: 'id', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'last6Digits', label: 'Last 6 Digits', type: 'text', required: true, placeholder: 'e.g. 123456' },
  ],
  cal: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'last4Digits', label: 'Last 4 Digits', type: 'text', required: false, placeholder: 'e.g. 1234' },
  ],
  max: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  priority: [
    { key: 'url', label: 'Server URL', type: 'text', required: true, placeholder: 'e.g. https://your-company.priority-software.com' },
    { key: 'company', label: 'Company Name', type: 'text', required: true, placeholder: 'Company code in Priority' },
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
  green_invoice: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'secret', label: 'Secret', type: 'password', required: true },
  ],
  cloudinary: [
    { key: 'cloudName', label: 'Cloud Name', type: 'text', required: true },
    { key: 'apiKey', label: 'API Key', type: 'text', required: true },
    { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
  ],
  google_drive: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
  ],
  gmail: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true },
  ],
  deel: [
    { key: 'apiToken', label: 'API Token', type: 'password', required: true },
  ],
};

export function getProviderFields(provider: string): CredentialFieldDef[] {
  return PROVIDER_FIELDS[provider.toLowerCase()] ?? [];
}

export function maskValue(value: string, fieldType: string): string {
  if (!value || value.length === 0) return '';

  if (fieldType === 'password') {
    return '\u2022'.repeat(8);
  }

  if (fieldType === 'id') {
    if (value.length <= 3) return '\u2022'.repeat(value.length);
    return '\u2022'.repeat(value.length - 3) + value.slice(-3);
  }

  // text type: show first 2 chars and last 2 chars
  if (value.length <= 4) return value[0] + '\u2022'.repeat(value.length - 1);
  return value.slice(0, 2) + '\u2022'.repeat(value.length - 4) + value.slice(-2);
}

export function buildMaskedSummary(
  provider: string,
  credentials: Record<string, string> | null,
): MaskedCredentialField[] {
  const fields = getProviderFields(provider);
  return fields.map(field => ({
    id: `${provider}:${field.key}`,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    hasValue: !!credentials?.[field.key],
    maskedValue: credentials?.[field.key]
      ? maskValue(credentials[field.key], field.type)
      : null,
    placeholder: field.placeholder ?? null,
  }));
}
