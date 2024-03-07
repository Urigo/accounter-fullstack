import Ajv, { ErrorObject } from 'ajv';
import type { Report } from './types.js';

export const validateSchema = (
  jsonSchema: Record<string, unknown>,
  data: Report[],
): { isValid: boolean; errors: ErrorObject[] | null | undefined } => {
  const ajv = new Ajv({
    verbose: true,
    allowMatchingProperties: true,
    strict: 'log',
  });
  let valid;
  try {
    valid = ajv.validate(jsonSchema, data);
  } catch (e) {
    return { isValid: false, errors: [e as ErrorObject] };
  }

  return { isValid: valid, errors: ajv.errors };
};
