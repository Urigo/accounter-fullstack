/**
 * Main API entry point for the SHAAM6111 generator package.
 * This file exports the public interface for the package.
 */

// Export types for public use
export * from './types/index.js';

// Export generators
export { generateReport } from './generators/index.js';

// Export parsers
export { parseReport } from './parsers/index.js';

// Export validators
export { validateData, validateReport } from './validation/index.js';

// Export file utilities (browser and node compatible versions)
export { convertReportToFile, readReportFromFile } from './utils/file-utils.js';
