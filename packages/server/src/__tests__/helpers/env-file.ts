import { readFile, writeFile } from 'fs/promises';

/**
 * Write or update an environment variable in a .env file
 * @param filePath - Path to the .env file
 * @param key - Environment variable key
 * @param value - Environment variable value
 */
export async function writeEnvVar(
  filePath: string,
  key: string,
  value: string,
): Promise<void> {
  let content = '';
  
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    // File doesn't exist, will create it
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const lines = content.split('\n');
  const keyPattern = new RegExp(`^${escapeRegExp(key)}=`);
  let found = false;

  // Remove trailing empty string from split (if content ended with \n)
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const updatedLines = lines.map(line => {
    if (keyPattern.test(line)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }

  // Join with newlines and add single trailing newline
  const newContent = updatedLines.join('\n') + '\n';
  
  await writeFile(filePath, newContent, 'utf-8');
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
