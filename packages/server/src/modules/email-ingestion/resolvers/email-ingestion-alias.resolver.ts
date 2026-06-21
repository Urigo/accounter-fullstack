import { GraphQLError } from 'graphql';
import type { MutationResolvers, QueryResolvers } from '../../../__generated__/types.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { EmailIngestionAliasProvider } from '../providers/email-ingestion-alias.provider.js';
import type { IGetAliasesResult } from '../types.js';

function mapAlias(row: IGetAliasesResult) {
  return {
    __typename: 'EmailIngestionAlias' as const,
    id: row.id,
    alias: row.alias,
    ownerId: row.owner_id,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const emailIngestionAliases: QueryResolvers['emailIngestionAliases'] = async (
  _parent,
  { businessId },
  { injector },
) => {
  const scope = await injector
    .get(ScopeProvider)
    .getReadScope(businessId ? [businessId] : undefined);
  const rows = await injector.get(EmailIngestionAliasProvider).listAliases(scope);
  return rows.map(mapAlias);
};

const createEmailIngestionAlias: MutationResolvers['createEmailIngestionAlias'] = async (
  _parent,
  { input },
  { injector },
) => {
  // Validate the caller may write to the target business (throws if out of scope).
  const ownerId = await injector.get(ScopeProvider).resolveWriteTarget(input.businessId);

  const alias = input.alias.trim();
  if (!alias) {
    return { __typename: 'CommonError', message: 'Alias must not be empty' };
  }

  try {
    const result = await injector.get(EmailIngestionAliasProvider).createAlias(alias, ownerId);
    if (!result.success) {
      return { __typename: 'CommonError', message: result.message };
    }
    return mapAlias(result.alias);
  } catch (err) {
    throw new GraphQLError('Failed to create email alias', {
      extensions: { code: 'INTERNAL_SERVER_ERROR', cause: err },
    });
  }
};

const setEmailIngestionAliasActive: MutationResolvers['setEmailIngestionAliasActive'] = async (
  _parent,
  { id, isActive },
  { injector },
) => {
  try {
    // RLS (tenant_isolation_write) scopes the UPDATE to the caller's own rows,
    // so a non-owned or unknown id yields 0 rows → "not found or not authorized".
    const result = await injector.get(EmailIngestionAliasProvider).setAliasActive(id, isActive);
    if (!result.success) {
      return { __typename: 'CommonError', message: result.message };
    }
    return mapAlias(result.alias);
  } catch (err) {
    throw new GraphQLError('Failed to update email alias', {
      extensions: { code: 'INTERNAL_SERVER_ERROR', cause: err },
    });
  }
};

export const emailIngestionAliasResolver = {
  Query: {
    emailIngestionAliases,
  },
  Mutation: {
    createEmailIngestionAlias,
    setEmailIngestionAliasActive,
  },
};
