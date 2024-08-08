import { ReactElement, ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '../components/ui/toaster.js';
import { AuthGuard } from './auth-guard.js';
import { UrqlProvider } from './urql.js';
import { UserProvider } from './user-provider.js';

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
          <QueryClientProvider client={queryClient}>
            <UserProvider>{children}</UserProvider>
          </QueryClientProvider>
          <Toaster />
        </UrqlProvider>
      </AuthGuard>
    </MantineProvider>
  );
}
