import { ReactElement, ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGuard } from './auth-guard';
import { UrqlProvider } from './urql';

const queryClient = new QueryClient();

export function Providers({ children }: { children?: ReactNode }): ReactElement {
  return (
    <MantineProvider
      withNormalizeCSS
      withGlobalStyles
      theme={{
        fontFamily: 'Roboto, sans-serif',
        fontSizes: { md: '14' },
      }}
    >
      <Notifications />
      <AuthGuard>
        <UrqlProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </UrqlProvider>
      </AuthGuard>
    </MantineProvider>
  );
}
