/** Golden `minimal` (SPEC §13.5): record 1000 with only required fields and codes, one shareholder. */
import type { GenerateOptions, Report1214Input } from '../../../src/index.js';
import { minimalInput } from '../builders.js';

export const input: Report1214Input = minimalInput();

export const options: GenerateOptions = { today: () => '2025-03-31' };
