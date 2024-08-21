import { ReactElement, ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { red } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '../components/ui/toaster.js';
import { AuthGuard } from './auth-guard.js';
import { UrqlProvider } from './urql.js';
import { UserProvider } from './user-provider.js';

const queryClient = new QueryClient();

export function Providers({ children }: { children?: ReactNode }): ReactElement {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#556cd6',
      },
      secondary: {
        main: '#19857b',
      },
      error: {
        main: red.A400,
      },
    },
  });

  return (
    <MantineProvider
      withNormalizeCSS
      withGlobalStyles
      theme={{
        fontFamily: 'Roboto, sans-serif',
        fontSizes: { md: '14' },
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Notifications />
        <AuthGuard>
          <UrqlProvider>
            <QueryClientProvider client={queryClient}>
              <UserProvider>{children}</UserProvider>
            </QueryClientProvider>
            <Toaster />
          </UrqlProvider>
        </AuthGuard>
      </ThemeProvider>
    </MantineProvider>
  );
}
