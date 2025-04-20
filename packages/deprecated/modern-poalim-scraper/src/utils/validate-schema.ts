import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export async function validateSchema(jsonSchema: Record<string, unknown>, data: unknown) {
  const ajv = new Ajv({ verbose: true, allowMatchingProperties: true });
  addFormats(ajv);
  let valid;
  try {
    valid = ajv.validate(jsonSchema, data);
  } catch (e) {
    console.log(e);
    return { isValid: false, errors: e };
  }

  return { isValid: valid, errors: ajv.errors };
}
