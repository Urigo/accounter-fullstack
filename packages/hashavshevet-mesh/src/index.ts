import https from 'node:https';
import { getBuiltMesh, getMeshSDK, Sdk } from './mesh-artifacts/index.js';

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

export const init = async (
  hashavshevetPersonalToken: string,
  hashavshevetCompanyKey: string,
  hashavshevetUrl: string,
): Promise<{ sdk: Sdk; execute: Awaited<ReturnType<typeof getBuiltMesh>>['execute'] }> => {
  const authToken = (await login(
    hashavshevetPersonalToken,
    hashavshevetCompanyKey,
    hashavshevetUrl,
  )) as string;

  const { execute } = await getBuiltMesh();
  const sdk = await getMeshSDK({ authToken, hashavshevetUrl });

  return { sdk, execute };
};

const login = (hashavshevetKey: string, company: string, hashavshevetUrl: string) => {
  const p = new Promise((resolve, reject) => {
    if (!hashavshevetKey || !company) {
      reject(new Error('Missing Hashavshevet user key or company ID'));
      return;
    }
    const path = `/createSession/${hashavshevetKey}/${company}`;

    const req = https.request(
      {
        host: hashavshevetUrl,
        path,
        method: 'GET',
      },
      res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (data === 'iligal token') {
            reject(new Error('Illegal token'));
          } else {
            resolve(data);
          }
        });
      },
    );

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
  return p;
};

export * from './mesh-artifacts/index.js';
