import { generateReport } from '../generators/generate-report.js';
import { parseReport } from '../parsers/index.js';
import { ReportData } from '../types/index.js';
import { validateReport } from '../validation/index.js';
import { fromWindows1255, toWindows1255 } from './encoding.js';

/**
 * Converts a SHAAM6111 report to a file with proper Windows-1255 encoding.
 * @param report The report string or ReportData object to convert.
 * @param fileName The name of the file to create.
 * @param validate If true, validates the report before converting.
 * @returns A File object containing the encoded report.
 */
export function convertReportToFile(
  report: string | ReportData,
  fileName: string = 'SHAAM6111.dat',
  validate: boolean = true,
): File {
  // If report is a ReportData object, convert it to a string
  let reportString = '';
  if (typeof report === 'string') {
    if (validate) {
      validateReport(report);
    }
    reportString = report;
  } else {
    reportString = generateReport(report, validate);
  }

  // Convert the report string to Windows-1255 encoding
  let encodedReport: Buffer;
  try {
    encodedReport = toWindows1255(reportString);
  } catch (error) {
    throw new Error(`Failed to encode report to Windows-1255: ${(error as Error).message}`);
  }

  // Create and return a File object with .dat extension
  return new File([encodedReport], fileName, {
    type: 'application/octet-stream',
  });
}

/**
 * Reads a SHAAM6111 report from a file with proper Windows-1255 decoding.
 * @param reportFile The file to read the report from.
 * @param parseToObject If true, parses the report into a ReportData object; if false, returns the raw report string.
 * @param validate If true, validates the report after decoding.
 * @returns A Promise that resolves to either the raw report string or a parsed ReportData object.
 */
export async function readReportFromFile(
  reportFile: File,
  parseToObject: boolean = false,
  validate: boolean = true,
): Promise<string | ReportData> {
  // Decode the buffer from Windows-1255 encoding
  const arrayBuffer = await reportFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let reportString: string;
  try {
    reportString = fromWindows1255(buffer);
  } catch (error) {
    throw new Error(`Failed to decode report from Windows-1255: ${(error as Error).message}`);
  }

  if (parseToObject) {
    // Return a parsed ReportData object
    return parseReport(reportString, validate);
  }

  // If validate is true, validate the report string
  if (validate) {
    validateReport(reportString);
  }

  // Return the raw string;
  return reportString;
}
