import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../stories/**/*.story.@(js|jsx|ts|tsx|mdx)',
  ],
  
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  
  viteFinal: async (config) => {
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    const { nodePolyfills } = await import('vite-plugin-node-polyfills');
    
    config.plugins = config.plugins || [];
    config.plugins.push(
      tailwindcss(),
      nodePolyfills({
        include: ['path', 'stream', 'util'],
        exclude: ['http'],
        globals: { Buffer: true, global: true, process: true },
      })
    );
    
    return config;
  },
  
  docs: {
    autodocs: 'tag',
  },
  
  core: {
    disableTelemetry: true,
  },
};

export default config;