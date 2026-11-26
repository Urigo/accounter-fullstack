import { GraphQLError } from 'graphql';

export const ALLOWED_ROLES = new Set([
  'business_owner',
  'accountant',
  'employee',
  'scraper',
  'gmail_listener',
]);

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
  return new GraphQLError(
    'This invitation has expired. Ask whoever invited you to send a new invitation.',
    { extensions: { code: 'TOKEN_EXPIRED' } },
  );
}

export function alreadyAcceptedError(): GraphQLError {
  return new GraphQLError(
    'This invitation has already been used or was replaced by a newer one. If you accepted it, sign in to continue; otherwise ask for a new invitation.',
    { extensions: { code: 'TOKEN_ALREADY_USED' } },
  );
}

/**
 * The signed-in account's email is not the one the invitation was sent to.
 *
 * Names both addresses. Only a signed-in caller holding the invitation's secret token reaches this,
 * so the invited address goes to someone who already has the invitation link; anonymous callers are
 * rejected before the invitation is looked up.
 */
export function emailMismatchError(invitedEmail: string, signedInEmail: string): GraphQLError {
  return new GraphQLError(
    `This invitation was sent to ${invitedEmail}, but you are signed in as ${signedInEmail}. Sign out and sign in as ${invitedEmail} to accept it, or ask for an invitation to ${signedInEmail}.`,
    {
      extensions: { code: 'INVITATION_EMAIL_MISMATCH', invitedEmail, signedInEmail },
    },
  );
}

/**
 * The signed-in account has no verified email, so it cannot be matched to the invitation.
 */
export function emailNotVerifiedError(signedInEmail: string | null): GraphQLError {
  const who = signedInEmail
    ? `The email address you signed in with (${signedInEmail})`
    : 'Your sign-in email address';
  return new GraphQLError(
    `${who} is not verified, so it cannot be matched to this invitation. Sign in with a method that verifies your email (for example Google, for a Google account), or verify the address and try again.`,
    { extensions: { code: 'EMAIL_NOT_VERIFIED', signedInEmail } },
  );
}
