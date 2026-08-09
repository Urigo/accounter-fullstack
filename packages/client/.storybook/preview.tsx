import { Provider } from 'urql';
import type { Preview } from '@storybook/react-vite';
import 'json-bigint-patch';
import '../src/index.css';
import { getUrqlClient } from '../src/providers/urql.js';

const preview: Preview = {
  decorators: [
    // Components that call useQuery/useMutation get a real urql client pointing
    // at http://localhost:4000/graphql — run `yarn mock:server` (repo root) to
    // feed them auto-mocked data.
    Story => (
      <Provider value={getUrqlClient()}>
        <Story />
      </Provider>
    ),
  ],
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;
