import { MantineProvider } from '@mantine/core';
import { NotificationsProvider } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

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
