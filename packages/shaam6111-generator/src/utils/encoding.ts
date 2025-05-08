import iconv from 'iconv-lite';

/**
 * Converts a UTF-8 string to a Windows-1255 encoded buffer.
 * @param input The input string to encode.
 * @returns A Buffer containing the Windows-1255 encoded data.
 */
export function toWindows1255(input: string): Buffer {
  return iconv.encode(input, 'windows-1255');
}

/**
 * Converts a Windows-1255 encoded buffer to a UTF-8 string.
 * @param buffer The input buffer to decode.
 * @returns A string decoded from the Windows-1255 buffer.
 */
export function fromWindows1255(buffer: Buffer): string {
  return iconv.decode(buffer, 'windows-1255');
}
