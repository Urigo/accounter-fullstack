import { GraphQLError } from 'graphql';

export const ALLOWED_ROLES = new Set([
  'business_owner',
  'accountant',
  'employee',
  'viewer',
  'scraper',
]);

/** Roles that are not allowed to perform any write mutations. */
export const READ_ONLY_ROLES = new Set(['viewer']);

type Auth0ErrorLike = Error & {
  status?: number;
  statusCode?: number;
  code?: number | string;
  retryAfter?: number;
  retry_after?: number;
  headers?: Record<string, string | number | undefined>;
  originalError?: {
    status?: number;
    statusCode?: number;
    code?: number | string;
    retryAfter?: number;
    retry_after?: number;
    headers?: Record<string, string | number | undefined>;
  };
};

function extractStatus(error: Auth0ErrorLike): number | undefined {
  return (
    error.statusCode ??
    error.status ??
    (typeof error.code === 'number' ? error.code : undefined) ??
    error.originalError?.statusCode ??
    error.originalError?.status ??
    (typeof error.originalError?.code === 'number' ? error.originalError.code : undefined)
  );
}

function extractRetryAfter(error: Auth0ErrorLike): number | undefined {
  const retryFromHeaders =
    error.headers?.['retry-after'] ??
    error.headers?.['Retry-After'] ??
    error.originalError?.headers?.['retry-after'] ??
    error.originalError?.headers?.['Retry-After'];

  const numericHeader =
    typeof retryFromHeaders === 'number'
      ? retryFromHeaders
      : retryFromHeaders
        ? Number.parseInt(String(retryFromHeaders), 10)
        : undefined;

  return error.retryAfter ?? error.retry_after ?? error.originalError?.retryAfter ?? numericHeader;
}

export function mapAuth0Error(error: unknown): GraphQLError {
  const auth0Error = error as Auth0ErrorLike;
  const status = extractStatus(auth0Error);
  const message = (auth0Error?.message ?? 'Auth0 error').toLowerCase();

  if (status === 429 || /rate limit|too many requests|429/.test(message)) {
    return new GraphQLError('Auth0 rate limit exceeded. Please retry shortly.', {
      extensions: {
        code: 'RATE_LIMITED',
        retryAfter: extractRetryAfter(auth0Error),
      },
    });
  }

  if (status === 409 || /already exists|user exists|already in use/.test(message)) {
    return new GraphQLError('User already exists in Auth0', {
      extensions: {
        code: 'USER_ALREADY_EXISTS',
      },
    });
  }

  console.error('Unexpected Auth0 error:', {
    message: auth0Error?.message,
    status,
    stack: auth0Error?.stack,
  });
  return new GraphQLError('Failed to create user in identity provider.', {
    extensions: {
      code: 'AUTH0_ERROR',
    },
  });
}

export function invalidTokenError(): GraphQLError {
  return new GraphQLError('Invalid invitation token', {
    extensions: { code: 'TOKEN_INVALID' },
  });
}

export function expiredTokenError(): GraphQLError {
  return new GraphQLError('Invitation token expired', {
    extensions: { code: 'TOKEN_EXPIRED' },
  });
}

export function alreadyAcceptedError(): GraphQLError {
  return new GraphQLError('Invitation already accepted', {
    extensions: { code: 'TOKEN_ALREADY_USED' },
  });
}
