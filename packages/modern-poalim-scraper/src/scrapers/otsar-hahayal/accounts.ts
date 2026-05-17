import { Page } from 'playwright';
import { $ZodIssue } from 'zod/v4/core';
import { sleep } from '../../utils/sleep.js';
import { OtsarHahayalOptions } from './index.js';
import { Account, userDataSchema } from './schemas.js';

export async function getAccounts(
  page: Page,
  options: OtsarHahayalOptions,
): Promise<{ data: Account[] | null; isValid: boolean | null; errors: $ZodIssue[] | null }> {
  // stale for random 0.5-1 second
  await sleep(Math.random() * 500 + 500);

  const [userData] = await Promise.all([
    page.waitForResponse(
      res =>
        res.url().includes('/MatafAngularRestApiService/rest/utils/userData') &&
        res.status() === 200,
    ),
    page.reload(),
  ]);
  const userDataJson = await userData.json();

  if (options.validateSchema) {
    const validation = userDataSchema.safeParse(userDataJson);
    return {
      data: validation.data?.accounts ?? null,
      isValid: validation.success,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  return { data: userDataJson?.accounts ?? null, isValid: null, errors: null };
}
