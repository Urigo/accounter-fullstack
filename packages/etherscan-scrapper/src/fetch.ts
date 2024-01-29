import { diary } from 'diary';
import { fetch as rawFetch } from '@whatwg-node/fetch';

const logger = diary('fetch');

export async function fetch<TResponse = unknown>(...args: Parameters<typeof rawFetch>) {
  const method = args[1]?.method || 'GET';
  const response = await rawFetch(...args);

  if (response.status >= 400) {
    logger.warn(`Fetch response status code is invalid: ${response.status}`);
    const responseBody = await response.text();

    throw new Error(
      `HTTP ${method} ${args[0]} ${response.status} ${response.statusText}:\n${responseBody}`,
    );
  }

  const responseBody = await response.json();

  return responseBody as TResponse;
}
