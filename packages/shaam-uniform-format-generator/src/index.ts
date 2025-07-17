/**
 * @accounter/shaam-uniform-format-generator
 *
 * A fully typed TypeScript library for generating, parsing, and validating
 * SHAAM uniform format tax reports (INI.TXT and BKMVDATA.TXT files).
 */

export * from './types/index.js';
export * from './generator/index.js';
export * from './parser/index.js';
export * from './validation/index.js';
export * from './generator/records/index.js';
export * from './utils/index.js';
export * from './constants.js';

// Main API
export { generateUniformFormatReport } from './api/generate-report.js';
export { parseUniformFormatFiles } from './api/parse-files.js';
