import { getMeshSDK, Sdk } from './mesh-artifacts/index.js';

const init = async (authToken: string, userName: string): Promise<{ sdk: Sdk }> => {
  const sdk = await getMeshSDK({
    authToken,
    userName,
  });

  return { sdk };
};

export * from './mesh-artifacts/index.js';
export { init };
