/**
 * File Helper Utilities for SHAAM Uniform Format Generator
 * Provides utilities for creating and managing File objects
 */

/**
 * Creates a File object with the given text content and filename
 * This is a utility function to standardize File creation across the package
 *
 * @param text - The text content for the file
 * @param name - The filename (should include extension)
 * @param options - Optional File constructor options
 * @returns A File object containing the text content
 *
 * @example
 * ```typescript
 * const iniFile = createFile(iniText, 'report.INI.TXT');
 * const dataFile = createFile(dataText, 'report.BKMVDATA.TXT');
 * ```
 */
export function createFile(
  text: string,
  name: string,
  options: FilePropertyBag = { type: 'text/plain' },
): File {
  if (!text || typeof text !== 'string') {
    throw new Error('Text content must be a non-empty string');
  }

  if (!name || typeof name !== 'string') {
    throw new Error('Filename must be a non-empty string');
  }

  // Ensure we have proper line endings for SHAAM format
  const normalizedText = text.replace(/\r?\n/g, '\r\n');

  return new File([normalizedText], name, {
    type: 'text/plain',
    ...options,
  });
}

/**
 * Creates an INI.TXT File object with standardized naming
 *
 * @param iniText - The INI text content
 * @param baseFileName - Base filename (without extension)
 * @returns A File object for the INI file
 *
 * @example
 * ```typescript
 * const iniFile = createIniFile(iniText, 'my-report');
 * // Creates file named: my-report.INI.TXT
 * ```
 */
export function createIniFile(iniText: string, baseFileName: string = 'report'): File {
  const fileName = `${baseFileName}.INI.TXT`;
  return createFile(iniText, fileName);
}

/**
 * Creates a BKMVDATA.TXT File object with standardized naming
 *
 * @param dataText - The data text content
 * @param baseFileName - Base filename (without extension)
 * @returns A File object for the data file
 *
 * @example
 * ```typescript
 * const dataFile = createDataFile(dataText, 'my-report');
 * // Creates file named: my-report.BKMVDATA.TXT
 * ```
 */
export function createDataFile(dataText: string, baseFileName: string = 'report'): File {
  const fileName = `${baseFileName}.BKMVDATA.TXT`;
  return createFile(dataText, fileName);
}

/**
 * Creates both INI and Data File objects from the report output
 *
 * @param iniText - The INI text content
 * @param dataText - The data text content
 * @param baseFileName - Base filename (without extension)
 * @returns An object containing both File objects
 *
 * @example
 * ```typescript
 * const { iniFile, dataFile } = createShaamFiles(iniText, dataText, 'my-report');
 * ```
 */
export function createShaamFiles(
  iniText: string,
  dataText: string,
  baseFileName: string = 'report',
): { iniFile: File; dataFile: File } {
  return {
    iniFile: createIniFile(iniText, baseFileName),
    dataFile: createDataFile(dataText, baseFileName),
  };
}

/**
 * Validates that a File object appears to be a valid SHAAM format file
 *
 * @param file - The File object to validate
 * @param expectedType - Expected file type ('ini' | 'data')
 * @returns True if the file appears valid
 *
 * @example
 * ```typescript
 * const isValidIni = validateShaamFile(iniFile, 'ini');
 * const isValidData = validateShaamFile(dataFile, 'data');
 * ```
 */
export function validateShaamFile(file: File, expectedType: 'ini' | 'data'): boolean {
  if (!file || !(file instanceof File)) {
    return false;
  }

  // Check filename convention
  const expectedExtension = expectedType === 'ini' ? '.INI.TXT' : '.BKMVDATA.TXT';
  if (!file.name.toUpperCase().endsWith(expectedExtension)) {
    return false;
  }

  // Check MIME type
  if (file.type !== 'text/plain') {
    return false;
  }

  // Check that file has content
  if (file.size === 0) {
    return false;
  }

  return true;
}

/**
 * Reads text content from a File object
 * This is an async utility for reading File objects back to text
 *
 * @param file - The File object to read
 * @returns Promise that resolves to the text content
 *
 * @example
 * ```typescript
 * const text = await readFileAsText(file);
 * ```
 */
export async function readFileAsText(file: File): Promise<string> {
  if (!file || !(file instanceof File)) {
    throw new Error('Input must be a valid File object');
  }

  return file.text();
}

/**
 * Gets file information from a File object
 *
 * @param file - The File object to inspect
 * @returns File information object
 *
 * @example
 * ```typescript
 * const info = getFileInfo(iniFile);
 * console.log(`File: ${info.name}, Size: ${info.size} bytes`);
 * ```
 */
export function getFileInfo(file: File): {
  name: string;
  size: number;
  type: string;
  lastModified: number;
} {
  if (!file || !(file instanceof File)) {
    throw new Error('Input must be a valid File object');
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

/**
 * File naming utilities for SHAAM format files
 */
export const FileNaming = {
  /**
   * Generates a standardized INI filename
   */
  iniFileName: (base: string = 'report'): string => `${base}.INI.TXT`,

  /**
   * Generates a standardized data filename
   */
  dataFileName: (base: string = 'report'): string => `${base}.BKMVDATA.TXT`,

  /**
   * Extracts base filename from a SHAAM file
   */
  extractBaseName: (fileName: string): string => {
    if (!fileName || !FileNaming.isValidShaamFileName(fileName)) {
      return 'report';
    }
    const name = fileName.replace(/\.(INI|BKMVDATA)\.TXT$/i, '');
    return name || 'report';
  },

  /**
   * Validates filename follows SHAAM conventions
   */
  isValidShaamFileName: (fileName: string): boolean => {
    return /\.(INI|BKMVDATA)\.TXT$/i.test(fileName);
  },
} as const;
