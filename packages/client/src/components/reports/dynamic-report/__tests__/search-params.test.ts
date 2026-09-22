import { describe, expect, it } from 'vitest';
import {
  clearPeriodOverride,
  selectTemplateParams,
  setPeriodParams,
  writeParam,
} from '../utils/search-params.js';

describe('writeParam', () => {
  it('sets a non-empty value', () => {
    const params = new URLSearchParams();
    writeParam(params, 'template', 'Balance Sheet');
    expect(params.get('template')).toBe('Balance Sheet');
  });

  it.each([null, undefined, ''])('removes the key for %p', value => {
    const params = new URLSearchParams('template=Balance+Sheet');
    writeParam(params, 'template', value);
    expect(params.has('template')).toBe(false);
  });
});

describe('selectTemplateParams', () => {
  // The regression this guards: the template name and the period reset used to be two separate
  // setSearchParams calls. react-router's updater sees the current render's params and navigates
  // at once, so the second call recomputed from a snapshot without the name and dropped it — the
  // template query stayed paused and the draft never loaded.
  it('sets the template name while dropping the previous draft period', () => {
    const params = new URLSearchParams({
      template: 'P&L 2024',
      from: '2024-01-01',
      to: '2024-12-31',
    });

    selectTemplateParams(params, 'Balance Sheet 2025');

    expect(params.get('template')).toBe('Balance Sheet 2025');
    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
  });

  it('releases a baseline pinned on the previous draft', () => {
    const params = new URLSearchParams({ template: 'P&L 2024', baseline: 'snapshot-1' });

    selectTemplateParams(params, 'Balance Sheet 2025');

    expect(params.has('baseline')).toBe(false);
  });

  it('leaves filters that are not draft-scoped alone', () => {
    const params = new URLSearchParams({ template: 'P&L 2024', owner: 'biz-1', zeroed: '1' });

    selectTemplateParams(params, 'Balance Sheet 2025');

    expect(params.get('owner')).toBe('biz-1');
    expect(params.get('zeroed')).toBe('1');
  });

  it('clears the template when none is selected', () => {
    const params = new URLSearchParams({ template: 'P&L 2024', from: '2024-01-01' });

    selectTemplateParams(params, null);

    expect(params.has('template')).toBe(false);
    expect(params.has('from')).toBe(false);
  });
});

describe('setPeriodParams', () => {
  // Same root cause: setting `from` and `to` in two calls kept only `to`.
  it('writes both dates', () => {
    const params = new URLSearchParams({ template: 'P&L 2024' });

    setPeriodParams(params, '2025-01-01', '2025-06-30');

    expect(params.get('from')).toBe('2025-01-01');
    expect(params.get('to')).toBe('2025-06-30');
    expect(params.get('template')).toBe('P&L 2024');
  });
});

describe('clearPeriodOverride', () => {
  it('drops both dates and nothing else', () => {
    const params = new URLSearchParams({
      from: '2025-01-01',
      to: '2025-06-30',
      template: 'P&L 2024',
      baseline: 'snapshot-1',
    });

    clearPeriodOverride(params);

    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
    expect(params.get('template')).toBe('P&L 2024');
    expect(params.get('baseline')).toBe('snapshot-1');
  });
});
