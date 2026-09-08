import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'urql';
import { MantineProvider } from '@mantine/core';
import type { Preview } from '@storybook/react-vite';
import 'json-bigint-patch';
import '../src/index.css';
import { getUrqlClient } from '../src/providers/urql.js';
import { UserContext } from '../src/providers/user-provider.js';

/**
 * Minimal stand-in for the signed-in user. Stories that care about specific business
 * ids nest their own `UserContext.Provider` — the nearest provider wins.
 */
const USER_CONTEXT = {
  userContext: {
    username: 'storybook',
    context: { adminBusinessId: 'owner-1' },
  },
  setUserContext: () => void 0,
} as never;

const preview: Preview = {
  decorators: [
    // Mantine is being removed from the client. This provider exists so components that
    // still import from `@mantine/*` render with their theme while the migration is in
    // flight; it is deleted along with the last Mantine import.
    Story => (
      <MantineProvider
        withGlobalStyles
        theme={{ fontFamily: 'Roboto, sans-serif', fontSizes: { md: '14' } }}
      >
        <Story />
      </MantineProvider>
    ),
    // Components that call useQuery/useMutation get a real urql client pointing
    // at http://localhost:4000/graphql — run `yarn mock:server` (repo root) to
    // feed them auto-mocked data. Stories that mock their own client nest a
    // `Provider` of their own, which takes precedence.
    Story => (
      <Provider value={getUrqlClient()}>
        <Story />
      </Provider>
    ),
    Story => (
      <UserContext.Provider value={USER_CONTEXT}>
        <Story />
      </UserContext.Provider>
    ),
    // react-router throws if a Router is nested inside another Router, so this is the
    // only one: stories needing a specific entry set `parameters.router.initialEntries`
    // rather than wrapping in their own MemoryRouter.
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={parameters['router']?.initialEntries ?? ['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    controls: { expanded: true },
    a11y: { test: 'todo' },
  },
};

export default preview;
