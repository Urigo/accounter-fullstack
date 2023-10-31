import { ReactElement, ReactNode } from 'react';
import { cacheExchange, createClient, fetchExchange, Provider } from 'urql';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';

const queryClient = new QueryClient();
const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [cacheExchange, fetchExchange],
});

export function Providers({ children }: { children?: ReactNode }): ReactElement {
  return (
    <MantineProvider
      theme={{
        fontFamily: 'Roboto, sans-serif',
        fontSizes: { md: '14' },
      }}
    >
      <Notifications />
      <Provider value={client}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    </MantineProvider>
  );
}
