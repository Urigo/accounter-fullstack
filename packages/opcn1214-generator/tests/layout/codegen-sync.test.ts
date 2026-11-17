import { readFileSync } from 'node:fs';
import { renderCodesModule, renderLayoutModule } from '../../scripts/layout/render.js';
import { latestLayoutYear, readLayoutSources } from '../../scripts/layout/sources.js';

const committed = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('generated layout modules', () => {
  it('src/layout/2024/layout.generated.ts is in sync with documentation/layout/2024/*.csv', async () => {
    const rendered = await renderLayoutModule(2024, readLayoutSources(2024));
    expect(rendered).toBe(committed('../../src/layout/2024/layout.generated.ts'));
  }, 30_000);

  it('src/model/codes.generated.ts is in sync with the newest layout', async () => {
    const year = latestLayoutYear();
    expect(year).toBe(2024);
    const rendered = await renderCodesModule(year, readLayoutSources(year));
    expect(rendered).toBe(committed('../../src/model/codes.generated.ts'));
  }, 30_000);
});
