import { ClientError } from 'graphql-request';

/**
 * A failed upload to the Accounter server, with a message meant for the task row.
 *
 * `graphql-request`'s own `ClientError` embeds the whole request — query and every
 * transaction in the variables — in its message, which buries the one line that
 * matters (the server's error) under kilobytes of JSON. This keeps the server's
 * message and code, and nothing of the payload.
 */
export class UploadError extends Error {
  override name = 'UploadError';

  constructor(
    message: string,
    /** Supporting lines (error code, server hint, affected table); no payload data. */
    readonly details?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

type ServerErrorExtensions = {
  code?: unknown;
  hint?: unknown;
  table?: unknown;
  constraint?: unknown;
};

function describeClientError(error: ClientError, operation: string): UploadError {
  const { status, errors } = error.response;

  if (status === 401 || status === 403) {
    return new UploadError(
      `Accounter server rejected the API key (HTTP ${status}) while running ${operation}`,
      'Check the API key in the scraper settings.',
      { cause: error },
    );
  }

  if (!errors?.length) {
    return new UploadError(`Accounter server returned HTTP ${status} for ${operation}`, undefined, {
      cause: error,
    });
  }

  const message = errors.map(e => e.message).join('; ');
  const details = new Set<string>();
  for (const e of errors) {
    const ext = (e.extensions ?? {}) as ServerErrorExtensions;
    if (typeof ext.code === 'string') details.add(`Code: ${ext.code}`);
    if (typeof ext.hint === 'string') details.add(`Hint: ${ext.hint}`);
    if (typeof ext.table === 'string') details.add(`Table: ${ext.table}`);
    if (typeof ext.constraint === 'string') details.add(`Constraint: ${ext.constraint}`);
  }

  return new UploadError(
    // The server already prefixes its own messages with the operation name.
    message.startsWith(operation) ? message : `${operation} failed: ${message}`,
    details.size > 0 ? [...details].join('\n') : undefined,
    { cause: error },
  );
}

/**
 * Turns anything thrown by a `graphql-request` call into an {@link UploadError}.
 * `serverUrl` is only used to say where the request was headed when it never got
 * a response.
 */
export function toUploadError(error: unknown, operation: string, serverUrl: string): UploadError {
  if (error instanceof UploadError) return error;
  if (error instanceof ClientError) return describeClientError(error, operation);

  const reason = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
  return new UploadError(
    `Request to the Accounter server at ${serverUrl} failed while running ${operation}: ${reason}`,
    cause && cause !== reason ? `Cause: ${cause}` : undefined,
    { cause: error },
  );
}
