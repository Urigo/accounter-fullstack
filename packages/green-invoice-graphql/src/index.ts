import { getMeshSDK, Sdk } from './mesh-artifacts/index.js';

export const init = async (id: string, secret: string): Promise<{ sdk: Sdk }> => {
  const authParams = {
    id,
    secret,
  };
  const greenInvoiceToken = await fetch('https://api.greeninvoice.co.il/api/v1/account/token', {
    method: 'POST',
    body: JSON.stringify(authParams),
    headers: { 'Content-Type': 'application/json' },
  })
    .then(res => res.json())
    .then((res: { token: string }) => res.token);

  const sdk = await getMeshSDK({ authToken: greenInvoiceToken });

  return { sdk };
};

export * from './mesh-artifacts/index.js';
