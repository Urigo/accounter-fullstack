import { describe, expect, it } from 'vitest';
import {
  buildMaskedSummary,
  getProviderFields,
  maskValue,
} from '../helpers/masking.js';

describe('maskValue', () => {
  it('masks password type with bullet chars', () => {
    const result = maskValue('mypassword', 'password');
    expect(result).toBe('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    expect(result).not.toContain('mypassword');
  });

  it('masks id type showing last 3 chars', () => {
    expect(maskValue('123456789', 'id')).toBe('\u2022\u2022\u2022\u2022\u2022\u2022789');
  });

  it('masks short id entirely', () => {
    expect(maskValue('ab', 'id')).toBe('\u2022\u2022');
  });

  it('masks text type showing first 2 and last 2 chars', () => {
    expect(maskValue('username', 'text')).toBe('us\u2022\u2022\u2022\u2022me');
  });

  it('masks short text keeping first char', () => {
    expect(maskValue('abc', 'text')).toBe('a\u2022\u2022');
  });

  it('returns empty string for empty input', () => {
    expect(maskValue('', 'text')).toBe('');
    expect(maskValue('', 'password')).toBe('');
  });

  it('never returns the original value for passwords', () => {
    const original = 's3cret!';
    const masked = maskValue(original, 'password');
    expect(masked).not.toContain(original);
  });

  it('never returns the full original value for ids', () => {
    const original = '123456789';
    const masked = maskValue(original, 'id');
    expect(masked).not.toBe(original);
    expect(masked.endsWith('789')).toBe(true);
  });
});

describe('getProviderFields', () => {
  it('returns fields for hapoalim', () => {
    const fields = getProviderFields('hapoalim');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.find(f => f.key === 'userCode')).toBeTruthy();
    expect(fields.find(f => f.key === 'password')).toBeTruthy();
  });

  it('returns fields for isracard', () => {
    const fields = getProviderFields('isracard');
    expect(fields.find(f => f.key === 'id')).toBeTruthy();
    expect(fields.find(f => f.key === 'password')).toBeTruthy();
    expect(fields.find(f => f.key === 'last6Digits')).toBeTruthy();
  });

  it('returns fields case-insensitively', () => {
    expect(getProviderFields('HAPOALIM')).toEqual(getProviderFields('hapoalim'));
  });

  it('returns empty array for unknown provider', () => {
    expect(getProviderFields('unknown_provider')).toEqual([]);
  });

  it('has field definitions for all main providers', () => {
    const providers = [
      'hapoalim', 'mizrahi', 'discount', 'leumi',
      'isracard', 'amex', 'cal', 'max',
      'green_invoice', 'cloudinary',
    ];
    for (const p of providers) {
      const fields = getProviderFields(p);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every(f => f.key && f.label && f.type)).toBe(true);
    }
  });
});

describe('buildMaskedSummary', () => {
  it('returns masked summary with values for configured credentials', () => {
    const summary = buildMaskedSummary('isracard', {
      id: '123456789',
      password: 'secret',
      last6Digits: '654321',
    });
    expect(summary.length).toBe(3);

    const idField = summary.find(f => f.key === 'id');
    expect(idField?.hasValue).toBe(true);
    expect(idField?.maskedValue).not.toBe('123456789');
    expect(idField?.maskedValue).toContain('789');

    const pwField = summary.find(f => f.key === 'password');
    expect(pwField?.hasValue).toBe(true);
    expect(pwField?.maskedValue).not.toContain('secret');
  });

  it('returns summary with hasValue=false when no credentials', () => {
    const summary = buildMaskedSummary('hapoalim', null);
    expect(summary.length).toBe(2);
    expect(summary.every(f => !f.hasValue)).toBe(true);
    expect(summary.every(f => f.maskedValue === null)).toBe(true);
  });

  it('handles partial credentials', () => {
    const summary = buildMaskedSummary('discount', { id: '12345' });
    const idField = summary.find(f => f.key === 'id');
    const pwField = summary.find(f => f.key === 'password');
    expect(idField?.hasValue).toBe(true);
    expect(pwField?.hasValue).toBe(false);
  });

  it('never includes raw secret values in the output', () => {
    const secret = 'my_super_secret_password_123';
    const summary = buildMaskedSummary('hapoalim', {
      userCode: 'testuser',
      password: secret,
    });
    const pwField = summary.find(f => f.key === 'password');
    expect(pwField?.maskedValue).not.toContain(secret);
  });
});
