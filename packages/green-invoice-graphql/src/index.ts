import type { Sdk } from './__generated__/sdk.js';
import { obtainAccessToken } from './access-token.js';
import { getMeshSDK } from './mesh-client.js';

/**
 * Obtains a new access token and returns an SDK bound to it. Every call requests a new token; to
 * reuse tokens across requests, use `createGreenInvoiceSdk` with a shared `GreenInvoiceTokenCache`.
 */
export const init = async (
  id: string,
  secret: string,
): Promise<{ sdk: Sdk; authToken: string }> => {
  const { accessToken: greenInvoiceToken } = await obtainAccessToken(id, secret);

  const sdk = getMeshSDK({ authToken: greenInvoiceToken });

  return { sdk, authToken: greenInvoiceToken };
};

export * from './__generated__/types.js';
export * from './__generated__/sdk.js';
export {
  createGreenInvoiceSdk,
  getMeshSDK,
  type GreenInvoiceContext,
  type GreenInvoiceSdkOptions,
} from './mesh-client.js';
export {
  GreenInvoiceTokenCache,
  isUnauthorizedError,
  obtainAccessToken,
  type AccessToken,
  type GetTokenOptions,
  type GreenInvoiceTokenCacheOptions,
  type GreenInvoiceTokenSource,
} from './access-token.js';
