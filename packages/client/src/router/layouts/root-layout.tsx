import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { red } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';
import { DocumentTitle } from '../../components/layout/document-title.js';
import { NavigationProgress } from '../../components/layout/navigation-progress.js';
import { Toaster } from '../../components/ui/sonner.js';
import { UrqlProvider, UserProvider } from '../../providers/index.js';

// Created outside the component to prevent recreation on every render
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
  components: {
    MuiCssBaseline: {
      // `index.css` declares the same four values on `body`, but it does so inside Tailwind's
      // `base` cascade layer — and any layered declaration loses to an unlayered one of the same
      // specificity, whatever the source order. `CssBaseline` emits its `body` rule unlayered
      // through emotion, so in the app it is MUI, not the stylesheet, that has the last word:
      // without this override the measured `line-height` silently goes 1.55 -> 1.5 and the font
      // stack reverts to MUI's `Roboto, Helvetica, Arial`.
      //
      // Restating them here (from the very same custom properties, so there is still one source
      // of truth) puts them in the rule that actually wins. The plain CSS stays where it is: it
      // is what applies in Storybook, which renders without this provider.
      styleOverrides: {
        body: {
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.55,
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-foreground)',
        },
      },
    },
  },
});

/**
 * Root layout - wraps all routes
 * Provides all app-level providers and navigation progress indicator
 */
export function RootLayout(): ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster />
      <UrqlProvider>
        <UserProvider>
          <DocumentTitle />
          <NavigationProgress />
          <Outlet />
        </UserProvider>
      </UrqlProvider>
    </ThemeProvider>
  );
}
