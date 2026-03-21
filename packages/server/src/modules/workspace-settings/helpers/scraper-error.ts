/**
 * Extracts a human-readable error message from a failed execFileAsync error.
 *
 * When a child process exits with a non-zero code, Node.js produces an error
 * whose message is just "Command failed: <path>". The actual useful error is
 * in `stderr` or `stdout` from the child. This function pulls the last
 * "Error: ..." line from the subprocess output, falling back progressively.
 */
export function extractScraperError(e: unknown): string {
  if (!(e instanceof Error)) return 'Sync failed';

  const execErr = e as Error & { stderr?: string; stdout?: string };

  // Prefer stderr since that is where console.error output lands
  for (const stream of [execErr.stderr, execErr.stdout]) {
    const text = stream?.trim();
    if (!text) continue;

    const errorLine = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('Error:'))
      .pop();

    if (errorLine) return errorLine;
  }

  // No "Error:" line found — return the last 500 chars of combined output
  const combined = [execErr.stderr, execErr.stdout]
    .filter(s => s?.trim())
    .join('\n')
    .trim();

  if (combined.length > 0) return combined.slice(-500);

  return e.message;
}
