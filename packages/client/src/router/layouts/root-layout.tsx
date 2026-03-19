import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { red } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentTitle } from '../../components/layout/document-title.js';
import { NavigationProgress } from '../../components/layout/navigation-progress.js';
import { Toaster } from '../../components/ui/sonner.js';
import { UrqlProvider, UserProvider } from '../../providers/index.js';
import { WorkspaceProvider } from '../../providers/workspace-provider.js';

// Create these outside the component to prevent recreation on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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

/**
 * Root layout - wraps all routes
 * Provides all app-level providers and navigation progress indicator
 */
export function RootLayout(): ReactElement {
  return (
    <MantineProvider
      withGlobalStyles
      theme={{
        fontFamily: 'Roboto, sans-serif',
        fontSizes: { md: '14' },
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster />
        <UrqlProvider>
          <QueryClientProvider client={queryClient}>
            <UserProvider>
              <WorkspaceProvider>
                <DocumentTitle />
                <NavigationProgress />
                <Outlet />
              </WorkspaceProvider>
            </UserProvider>
          </QueryClientProvider>
        </UrqlProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}
