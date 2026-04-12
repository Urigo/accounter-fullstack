Scaffold a new GraphQL module named: $ARGUMENTS

1. Look at existing modules under `packages/server/src/modules/` for the current patterns
2. Create the module directory: `packages/server/src/modules/$ARGUMENTS/`
3. Create these files following existing patterns:
   - `typeDefs/$ARGUMENTS.graphql.ts` — GraphQL type definitions using `gql` tag
   - `resolvers/index.ts` — resolver map
   - `providers/$ARGUMENTS.provider.ts` — data provider with `@Injectable()`
   - `helpers/` — utility functions specific to this module
   - `types.ts` — module-specific TypeScript types
   - `index.ts` — module registration with `createModule()`
4. Register the module in the application's module list
5. Run `yarn generate` to update types
6. Run `yarn lint` to verify
