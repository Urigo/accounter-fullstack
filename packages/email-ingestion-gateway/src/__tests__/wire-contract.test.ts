import { existsSync, readFileSync } from 'node:fs';
import { buildSchema, coerceInputValue, isInputObjectType, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { INGEST_EMAIL_MUTATION, REQUEST_INGEST_CONTROL_MUTATION } from '../graphql/mutations.js';
import { extractFromMime } from '../mime-extractor.js';
import { toControlSenderEvidence, type ControlInput } from '../server-client.js';

/**
 * The input-shape half of the wire contract.
 *
 * `contracts.ts` parity (here and server-side) guards the `IngestOutcome` /
 * `IngestReasonCode` string constants. Nothing guarded the *inputs* — and that is
 * the half that broke: the gateway sent `senderEvidence.forwardedBlocks[].date`,
 * which `ForwardedBlockInput` has never defined, so GraphQL rejected every
 * forwarded email whose quoted block carried a `Date:` line with
 * `HTTP 400: Field "date" is not defined by type "ForwardedBlockInput"`.
 *
 * `coerceInputValue` is the very function that produced that error, so this suite
 * fails in exactly the way production did — without a server, a DB or a network.
 */

// The root `schema.graphql` is generated and git-ignored, but it is the server's
// real SDL and is in `server-tests.yml`'s codegen cache path, so it exists wherever
// this suite runs. Fail loudly rather than skip: a guard that silently opts out is
// how the drift this suite exists to catch survived for weeks.
const SCHEMA_URL = new URL('../../../../schema.graphql', import.meta.url);
if (!existsSync(SCHEMA_URL)) {
  throw new Error(
    'schema.graphql not found — run `yarn generate:graphql` from the repo root before this suite',
  );
}
const schema = buildSchema(readFileSync(SCHEMA_URL, 'utf8'));

/**
 * Every committed fixture. The four `forwarded-*` ones carry quoted `Date:` lines
 * and are what reproduce the 400; the `relayed-*` ones have no quoted block and
 * are the control group that always passed (matching the two emails that ingested
 * fine while the rest failed).
 */
const FIXTURES = [
  'forwarded-cloudflare.eml',
  'forwarded-nested-provider.eml',
  'forwarded-relayed-newsletter.eml',
  'forwarded-relayed-reseller.eml',
  'relayed-provider-invoice.eml',
  'relayed-provider-invoice-hebrew.eml',
  'relayed-self-issued.eml',
  'relayed-self-issued-own-name.eml',
] as const;

function fixture(name: string): Buffer {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}

/** Coerce a value against a named input type, collecting every error the way yoga does. */
function coercionErrors(value: unknown, typeName: string): string[] {
  const inputType = schema.getType(typeName);
  if (!isInputObjectType(inputType)) {
    throw new Error(`${typeName} is not an input object type in the server SDL`);
  }
  const errors: string[] = [];
  coerceInputValue(value, inputType, (path, _invalidValue, error) =>
    errors.push(`input${path.map(segment => `.${String(segment)}`).join('')}: ${error.message}`),
  );
  return errors;
}

describe('wire contract: gateway → server', () => {
  it.each([
    ['requestIngestControl', REQUEST_INGEST_CONTROL_MUTATION],
    ['ingestEmail', INGEST_EMAIL_MUTATION],
  ])('the %s document validates against the server SDL', (_name, document) => {
    expect(validate(schema, parse(document)).map(String)).toEqual([]);
  });

  it.each(FIXTURES)('%s: the control input coerces cleanly against IngestControlInput', async name => {
    const extraction = await extractFromMime(fixture(name));
    if (!extraction.success) {
      throw new Error(`fixture ${name} failed to extract: ${extraction.reason}`);
    }

    const input: ControlInput = {
      recipientAlias: 'invoices@acme.example.com',
      messageId: '<wire-contract@example.com>',
      rawMessageHash: 'a'.repeat(64),
      senderEvidence: toControlSenderEvidence(extraction.senderEvidence),
    };

    // Round-trip through JSON first: that is what `graphql-request` puts on the wire,
    // and it is what drops undefined-valued keys — so this coerces the exact bytes
    // the server would have rejected, not a richer in-process object.
    expect(coercionErrors(JSON.parse(JSON.stringify(input)), 'IngestControlInput')).toEqual([]);
  });

  it('rejects an unknown forwarded-block field, proving the guard has teeth', async () => {
    const extraction = await extractFromMime(fixture('forwarded-nested-provider.eml'));
    if (!extraction.success) throw new Error('fixture failed to extract');

    // The pre-fix payload: the extractor's own evidence, passed through unprojected.
    const unprojected = {
      recipientAlias: 'invoices@acme.example.com',
      messageId: '<wire-contract@example.com>',
      rawMessageHash: 'a'.repeat(64),
      senderEvidence: extraction.senderEvidence,
    };

    const errors = coercionErrors(
      JSON.parse(JSON.stringify(unprojected)),
      'IngestControlInput',
    );
    // Both nested blocks in this fixture carry a quoted `Date:` line.
    expect(errors).toEqual([
      'input.senderEvidence.forwardedBlocks.0: Field "date" is not defined by type "ForwardedBlockInput".',
      'input.senderEvidence.forwardedBlocks.1: Field "date" is not defined by type "ForwardedBlockInput".',
    ]);
  });
});
