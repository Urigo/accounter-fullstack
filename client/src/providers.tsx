import { MantineProvider } from '@mantine/core';
import { NotificationsProvider } from '@mantine/notifications';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

export function Providers({ children }: { children?: ReactNode }) {
  return (
    <MantineProvider
      theme={{
        fontFamily: 'Roboto, sans-serif',
        fontSizes: { md: 14 },
      }}
    >
      <NotificationsProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NotificationsProvider>
    </MantineProvider>
  );
}
