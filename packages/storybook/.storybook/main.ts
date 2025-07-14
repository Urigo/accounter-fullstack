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
    // Import the client's vite config to inherit all configurations
    const { mergeConfig } = await import('vite');
    const { default: clientViteConfig } = await import('../../client/vite.config.ts');
    
    // Merge client config with storybook config
    const mergedConfig = mergeConfig(config, {
      plugins: clientViteConfig.plugins,
      define: clientViteConfig.define,
      optimizeDeps: clientViteConfig.optimizeDeps,
      build: {
        ...clientViteConfig.build,
        rollupOptions: {
          external: ['react', 'react-dom'],
        },
      },
    });
    
    return mergedConfig;
  },
  
  docs: {
    autodocs: 'tag',
  },
  
  core: {
    disableTelemetry: true,
  },
};

export default config;