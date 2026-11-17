/**
 * Main API entry point for the SHAAM6111 generator package.
 * This file exports the public interface for the package.
 */

// Export types for public use
export * from './types/index.js';

// Export generators
export {
  generateReport,
  frameReportFile,
  encodeReportFile,
  RECORD_TERMINATOR,
  END_OF_FILE_MARKER,
  MAX_REPORTS_PER_FILE,
  REPORT_RECORD_LENGTH,
} from './generators/index.js';

// Export parsers
export { parseReport } from './parsers/index.js';

// Export validators
export { isValidIsraeliID, validateData, validateReport } from './validation/index.js';

// Export file utilities (browser and node compatible versions)
export { convertReportToFile, readReportFromFile } from './utils/file-utils.js';
