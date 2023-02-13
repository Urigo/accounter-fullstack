import { ReactNode } from 'react';
import { createClient, Provider } from 'urql';
import { MantineProvider } from '@mantine/core';
import { NotificationsProvider } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { multipartFetchExchange } from '@urql/exchange-multipart-fetch';

const queryClient = new QueryClient();
const client = createClient({
  url: 'http://localhost:4000/graphql',
  exchanges: [multipartFetchExchange],
});

export function Providers({ children }: { children?: ReactNode }) {
  return (
    <MantineProvider
      theme={{
        fontFamily: 'Roboto, sans-serif',
        fontSizes: { md: 14 },
      }}
    >
      <NotificationsProvider>
        <Provider value={client}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </Provider>
      </NotificationsProvider>
    </MantineProvider>
  );
}
