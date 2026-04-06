import { getMeshSDK, Sdk } from './mesh-artifacts/index.js';

async function obtainAccessToken(id: string, secret: string) {
  try {
    const authParams = {
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    };
    const res = await fetch('https://api.morning.co/idp/v1/oauth/token', {
      method: 'POST',
      body: JSON.stringify(authParams),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status !== 200) {
      throw Error(
        `Failed to obtain access token, status code: ${res.status}, response: ${await res.text()}`,
      );
    }

    const data = await res.json();
    return data.accessToken;
  } catch (e) {
    console.error('Failed to obtain access token', e);
    throw Error('Failed to obtain access token', { cause: e });
  }
}

export const init = async (
  id: string,
  secret: string,
): Promise<{ sdk: Sdk; authToken: string }> => {
  const greenInvoiceToken = await obtainAccessToken(id, secret);

  const sdk = await getMeshSDK({ authToken: greenInvoiceToken });

  return { sdk, authToken: greenInvoiceToken };
};

export * from './mesh-artifacts/index.js';
