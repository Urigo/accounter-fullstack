import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Provider as UrqlProvider, createClient, fetchExchange } from 'urql';
import { ErrorBoundary } from 'react-error-boundary';

// Import the client's main CSS file to inherit all styles
import '../../client/src/index.css';

// Create a mock GraphQL client for Storybook
const mockUrqlClient = createClient({
  url: 'http://localhost:3000/graphql', // Mock URL
  exchanges: [fetchExchange],
});

// Create a mock React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{ padding: '20px', color: 'red' }}>
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
  </div>
);

// Global decorator that wraps all stories with necessary providers
const withProviders = (Story: any) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <MantineProvider>
          <QueryClientProvider client={queryClient}>
            <UrqlProvider value={mockUrqlClient}>
              <div className="min-h-screen bg-background text-foreground">
                <Story />
              </div>
            </UrqlProvider>
          </QueryClientProvider>
        </MantineProvider>
      </ThemeProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#0a0a0a',
        },
      ],
    },
    docs: {
      theme: undefined, // Use system theme
    },
  },
  
  decorators: [withProviders],
  
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;