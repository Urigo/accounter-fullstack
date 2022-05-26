import { MantineProvider } from '@mantine/core';
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MantineProvider>
  );
}
