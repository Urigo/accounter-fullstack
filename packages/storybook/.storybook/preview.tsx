import { ThemeProvider } from 'next-themes';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter } from 'react-router-dom';
import { createClient, fetchExchange, Provider as UrqlProvider } from 'urql';
import { MantineProvider } from '@mantine/core';
import type { Preview } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import the client's main CSS file to inherit all styles
import '../../client/src/index.css';

// Create a mock GraphQL client for Storybook
const mockUrqlClient = createClient({
  url: 'http://localhost:3000/graphql',
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
  },

  decorators: [
    Story => (
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
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
    ),
  ],
};

export default preview;
