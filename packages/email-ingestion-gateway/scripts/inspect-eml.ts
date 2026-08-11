/**
 * Local diagnostic: print exactly what the gateway extracts from a raw `.eml`
 * file — subject, every sender-evidence field (including the issuer candidates
 * recovered from forwarded-header blocks), and the document list. Use it to see
 * which addresses are available for business recognition before/after forwarding.
 *
 * Capture a real sample from Gmail: open the message → ⋮ → "Show original" →
 * "Download Original", then:
 *
 *   yarn workspace @accounter/email-ingestion-gateway inspect:eml path/to/message.eml
 *
 * Pass `--json` to emit the raw sender evidence instead. That is the exact payload
 * the gateway sends to `requestIngestControl`, so it can be fed straight into the
 * server's `classifyEmail` to check a real sample against the policy — without
 * importing across the package boundary, which this package deliberately avoids.
 */
import { readFile } from 'node:fs/promises';
import { extractFromMime } from '../src/mime-extractor.js';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: inspect:eml <path-to-.eml> [--json]');
    process.exitCode = 1;
    return;
  }
  const asJson = process.argv.includes('--json');

  const raw = await readFile(path);
  const result = await extractFromMime(raw);

  if (!result.success) {
    console.error(`Extraction failed: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  const { subject, senderEvidence, documents } = result;

  if (asJson) {
    console.log(JSON.stringify({ subject, senderEvidence }, null, 2));
    return;
  }

  console.log('Subject:', subject ?? '(none)');
  console.log('\nSender evidence:');
  console.log('  from:            ', senderEvidence.from ?? '(none)');
  console.log('  replyTo:         ', senderEvidence.replyTo ?? '(none)');
  console.log('  originalFrom:    ', senderEvidence.originalFrom ?? '(none)');
  console.log('  originalSender:  ', senderEvidence.originalSender ?? '(none)');
  console.log('  forwardedTo:     ', senderEvidence.forwardedTo ?? '(none)');
  console.log('  listId:          ', senderEvidence.listId ?? '(none)');
  console.log(
    '  listAddresses:   ',
    senderEvidence.listAddresses.length ? senderEvidence.listAddresses : '(none)',
  );
  console.log(
    '  forwardedBlocks: ',
    senderEvidence.forwardedBlocks.length
      ? senderEvidence.forwardedBlocks.map(
          block => `${block.fromDisplayName ?? '(no name)'} <${block.from ?? 'no address'}>`,
        )
      : '(none)',
  );
  console.log(
    '  issuerCandidates:',
    senderEvidence.issuerCandidates.length ? senderEvidence.issuerCandidates : '(none)',
  );

  console.log(`\nDocuments (${documents.length}):`);
  for (const doc of documents) {
    console.log(`  - ${doc.filename ?? '(unnamed)'} | ${doc.mimeType} | ${doc.size} bytes`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
