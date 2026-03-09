import { defaultFieldResolver, GraphQLError, GraphQLSchema } from 'graphql';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { AuthContextProvider } from '../providers/auth-context.provider.js';

type RoleDirectiveArgs = {
  role: string;
};

type AnyRoleDirectiveArgs = {
  roles: string[];
};

type MaybeContext = {
  injector?: { get: (token: unknown) => unknown };
  ɵinjector?: { get: (token: unknown) => unknown };
  ɵgetModuleContext?: (
    moduleId: string,
    context: unknown,
  ) => { injector?: { get: (token: unknown) => unknown } };
};

function extractModuleIdFromResolver(resolve: unknown): string | undefined {
  if (typeof resolve !== 'function') {
    return undefined;
  }

  const resolverWithSymbols = resolve as unknown as Record<symbol, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(resolve)) {
    const metadata = resolverWithSymbols[symbol];
    if (
      metadata &&
      typeof metadata === 'object' &&
      'moduleId' in metadata &&
      typeof (metadata as { moduleId?: unknown }).moduleId === 'string'
    ) {
      return (metadata as { moduleId: string }).moduleId;
    }
  }

  return undefined;
}

function resolveInjector(context: MaybeContext, moduleId: string | undefined) {
  if (context?.injector) {
    return context.injector;
  }

  if (context?.ɵinjector) {
    return context.ɵinjector;
  }

  if (typeof context?.ɵgetModuleContext !== 'function') {
    return undefined;
  }

  const moduleCandidates = [moduleId, 'auth'].filter(
    (candidate): candidate is string => !!candidate,
  );

  for (const candidate of moduleCandidates) {
    try {
      const moduleContext = context.ɵgetModuleContext(candidate, context);
      if (moduleContext?.injector) {
        return moduleContext.injector;
      }
    } catch {
      // Ignore invalid module candidate and continue with the next fallback.
    }
  }

  return undefined;
}

export function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: fieldConfig => {
      const requiresAuthDirective = getDirective(schema, fieldConfig, 'requiresAuth')?.[0];
      const requiresRoleDirective = getDirective(schema, fieldConfig, 'requiresRole')?.[0] as
        | RoleDirectiveArgs
        | undefined;
      const requiresAnyRoleDirective = getDirective(schema, fieldConfig, 'requiresAnyRole')?.[0] as
        | AnyRoleDirectiveArgs
        | undefined;

      if (!requiresAuthDirective && !requiresRoleDirective && !requiresAnyRoleDirective) {
        return fieldConfig;
      }

      const { resolve = defaultFieldResolver } = fieldConfig;
      const moduleId = extractModuleIdFromResolver(resolve);

      return {
        ...fieldConfig,
        resolve: async (source, args, context: MaybeContext, info) => {
          const injector = resolveInjector(context, moduleId);

          const authProvider = injector?.get(AuthContextProvider) as
            | AuthContextProvider
            | undefined;

          if (!authProvider) {
            throw new GraphQLError('Authentication required', {
              extensions: { code: 'UNAUTHENTICATED' },
            });
          }

          const authContext = await authProvider.getAuthContext();

          if (!authContext?.user) {
            throw new GraphQLError('Authentication required', {
              extensions: { code: 'UNAUTHENTICATED' },
            });
          }

          if (requiresRoleDirective) {
            const role = requiresRoleDirective.role;
            if (authContext.user.roleId !== role) {
              throw new GraphQLError(`Requires role: ${role}`, {
                extensions: { code: 'FORBIDDEN' },
              });
            }
          }

          if (requiresAnyRoleDirective) {
            const roles = requiresAnyRoleDirective.roles;
            if (!roles.includes(authContext.user.roleId)) {
              throw new GraphQLError(`Requires one of roles: ${roles.join(', ')}`, {
                extensions: { code: 'FORBIDDEN' },
              });
            }
          }

          return resolve(source, args, context, info);
        },
      };
    },
  });
}
