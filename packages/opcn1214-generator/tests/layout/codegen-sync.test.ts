import { readFileSync } from 'node:fs';
import { renderLayoutModule } from '../../scripts/layout/render.js';
import { layoutModuleUrl, layoutYears, readLayoutSources } from '../../scripts/layout/sources.js';

describe('generated layout modules', () => {
  it('finds the 2024 layout data', () => {
    expect(layoutYears()).toContain(2024);
  });

  it.each(layoutYears())(
    'src/layout/%i/layout.generated.ts is in sync with its CSVs',
    async year => {
      const rendered = await renderLayoutModule(year, readLayoutSources(year));
      expect(rendered).toBe(readFileSync(layoutModuleUrl(year), 'utf8'));
    },
    30_000,
  );
});
