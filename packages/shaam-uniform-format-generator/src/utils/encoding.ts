import { readFileSync, writeFileSync } from 'node:fs';
import iconv from 'iconv-lite';

const ENCODING = 'windows-1255';

export function readTextFile(filePath: string): string {
  const buffer = readFileSync(filePath);
  return iconv.decode(buffer, ENCODING);
}

export function writeTextFile(filePath: string, content: string): void {
  const buffer = iconv.encode(content, ENCODING);
  writeFileSync(filePath, buffer);
}
