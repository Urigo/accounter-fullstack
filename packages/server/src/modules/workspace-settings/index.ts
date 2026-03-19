import { createModule } from 'graphql-modules';
import { WorkspaceSettingsProvider } from './providers/workspace-settings.provider.js';
import { workspaceSettingsResolvers } from './resolvers/workspace-settings.resolvers.js';
import workspaceSettingsTypeDefs from './typeDefs/workspace-settings.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const workspaceSettingsModule = createModule({
  id: 'workspaceSettings',
  dirname: __dirname,
  typeDefs: [workspaceSettingsTypeDefs],
  resolvers: [workspaceSettingsResolvers],
  providers: () => [WorkspaceSettingsProvider],
});
