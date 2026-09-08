import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  // `@storybook/addon-vitest` (which would run these stories as browser tests in CI) is
  // deliberately absent: as of 10.6.0 it peer-requires vitest ^3 || ^4 and this repo is on
  // vitest 5. Stories are exercised in CI through portable stories instead — see
  // `src/__tests__/stories.test.tsx`. Revisit once the addon supports vitest 5.
  addons: ['@storybook/addon-a11y'],
};

export default config;
