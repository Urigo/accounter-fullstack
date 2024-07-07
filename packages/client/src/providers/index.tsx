import { ReactElement, ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '../components/ui/toaster';
// import { AuthGuard } from './auth-guard';
import { UrqlProvider } from './urql';
import { UserProvider } from './user-provider';

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
      <UrqlProvider>
        <QueryClientProvider client={queryClient}>
          <UserProvider>{children}</UserProvider>
        </QueryClientProvider>
        <Toaster />
      </UrqlProvider>
    </MantineProvider>
  );
}
