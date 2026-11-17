import { readFileSync } from 'node:fs';
import { renderLayoutModule } from '../../scripts/layout/render.js';
import { readLayoutSources } from '../../scripts/layout/sources.js';

describe('generated layout modules', () => {
  it('src/layout/2024/layout.generated.ts is in sync with documentation/layout/2024/*.csv', async () => {
    const committed = readFileSync(
      new URL('../../src/layout/2024/layout.generated.ts', import.meta.url),
      'utf8',
    );
    const rendered = await renderLayoutModule(2024, readLayoutSources(2024));
    expect(rendered).toBe(committed);
  }, 30_000);
});
