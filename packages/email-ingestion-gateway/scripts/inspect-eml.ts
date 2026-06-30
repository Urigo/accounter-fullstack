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
 */
import { readFile } from 'node:fs/promises';
import { extractFromMime } from '../src/mime-extractor.js';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: inspect:eml <path-to-.eml>');
    process.exitCode = 1;
    return;
  }

  const raw = await readFile(path);
  const result = await extractFromMime(raw);

  if (!result.success) {
    console.error(`Extraction failed: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  const { subject, senderEvidence, documents } = result;
  console.log('Subject:', subject ?? '(none)');
  console.log('\nSender evidence:');
  console.log('  from:            ', senderEvidence.from ?? '(none)');
  console.log('  replyTo:         ', senderEvidence.replyTo ?? '(none)');
  console.log('  originalFrom:    ', senderEvidence.originalFrom ?? '(none)');
  console.log('  forwardedTo:     ', senderEvidence.forwardedTo ?? '(none)');
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
