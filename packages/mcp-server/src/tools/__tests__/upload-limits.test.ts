import { describe, expect, it } from 'vitest';
import { MAX_MCP_BODY_BYTES } from '../../mcp/handler.js';
import { MAX_DOCUMENT_BYTES, MAX_TOTAL_DOCUMENT_BYTES } from '../documents-write.js';

/**
 * Contract between the upload caps and the transport that has to carry them.
 *
 * This exists because the two silently disagreed once: the tool advertised 5MB
 * per file while `MAX_MCP_BODY_BYTES` capped the whole JSON-RPC body at 1MB, so
 * a 5MB upload died as a 413 before the tool's own check ever ran. The tool was
 * documenting a capability it could not deliver.
 *
 * Base64 costs 4/3 of the decoded size, and the operation JSON, filenames, and
 * MIME types ride along in the same body, so the caps must leave headroom on top
 * of that expansion.
 */

const BASE64_EXPANSION = 4 / 3;
/** Room for the JSON-RPC envelope: method, params, filenames, MIME types. */
const ENVELOPE_HEADROOM_BYTES = 64 * 1024;

describe('upload caps vs the transport body limit', () => {
  it('keeps a full-size call inside MAX_MCP_BODY_BYTES', () => {
    const encoded = MAX_TOTAL_DOCUMENT_BYTES * BASE64_EXPANSION;
    expect(encoded + ENVELOPE_HEADROOM_BYTES).toBeLessThanOrEqual(MAX_MCP_BODY_BYTES);
  });

  it('keeps a single largest document inside MAX_MCP_BODY_BYTES', () => {
    const encoded = MAX_DOCUMENT_BYTES * BASE64_EXPANSION;
    expect(encoded + ENVELOPE_HEADROOM_BYTES).toBeLessThanOrEqual(MAX_MCP_BODY_BYTES);
  });

  it('does not advertise a per-file cap larger than the per-call one', () => {
    expect(MAX_DOCUMENT_BYTES).toBeLessThanOrEqual(MAX_TOTAL_DOCUMENT_BYTES);
  });

  it('stays small enough to be emittable as tool arguments', () => {
    // The binding limit in practice is neither cap above but the model's own
    // per-message output budget: it must *type* the base64. At roughly 3 chars
    // per token, this bounds a single document to a few tens of thousands of
    // tokens — large, but within a single message. A cap that failed this would
    // be unreachable in practice no matter what the server allows.
    const approxTokens = (MAX_DOCUMENT_BYTES * BASE64_EXPANSION) / 3;
    expect(approxTokens).toBeLessThan(150_000);
  });
});
