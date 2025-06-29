import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import type { RecordSpec, SpecField, YearSpec } from '../types/spec.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Zod schema for validation
const SpecFieldSchema = z.object({
  fieldCode: z.string().min(1),
  fieldName: z.string().min(1),
  start: z.number().min(0),
  length: z.number().min(1),
  type: z.enum(['string', 'number', 'date']),
  required: z.boolean(),
  format: z.string().optional(),
  rtl: z.boolean().optional(),
  enumValues: z.array(z.string()).optional(),
  defaultValue: z.union([z.string(), z.number(), z.null()]).optional(),
  padding: z.enum(['left', 'right']).optional(),
  description: z.string().optional(),
})

const RecordSpecSchema = z.object({
  recordType: z.string().min(1),
  recordLength: z.number().min(1),
  repeatable: z.boolean(),
  minOccurs: z.number().min(0).optional(),
  maxOccurs: z.number().min(1).optional(),
  orderIndex: z.number().min(1),
  fields: z.array(SpecFieldSchema),
  description: z.string().optional(),
})

const YearSpecSchema = z.object({
  year: z.number().min(2020).max(2050),
  records: z.array(RecordSpecSchema),
})

/**
 * Load specification for a given tax year
 * @param year - The tax year (e.g., 2024)
 * @returns Array of record specifications
 * @throws Error if year is unsupported or specification is invalid
 */
export async function getSpecForYear(year: number): Promise<RecordSpec[]> {
  try {
    const configPath = join(__dirname, `${year}.json`)
    const configContent = await readFile(configPath, 'utf-8')
    const rawConfig = JSON.parse(configContent)

    // Validate the configuration using Zod
    const validatedConfig = YearSpecSchema.parse(rawConfig)

    // Additional business logic validations
    validateRecordSpecs(validatedConfig.records)

    return validatedConfig.records
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Configuration for year ${year} is not supported. Available years: 2024`)
    }
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration for year ${year}: ${error.message}`)
    }
    throw error
  }
}

/**
 * Synchronous version that imports the JSON directly (for build-time usage)
 * @param year - The tax year
 * @returns Array of record specifications
 */
export function getSpecForYearSync(year: number): RecordSpec[] {
  const supportedYears = [2024]

  if (!supportedYears.includes(year)) {
    throw new Error(
      `Configuration for year ${year} is not supported. Available years: ${supportedYears.join(', ')}`
    )
  }

  // Dynamic import for the specific year
  try {
    let config: YearSpec
    switch (year) {
      case 2024:
        // Note: In a real implementation, you might want to use dynamic imports
        // For now, we'll throw an error to indicate this needs to be implemented
        throw new Error('Synchronous loading not yet implemented. Use getSpecForYear instead.')
      default:
        throw new Error(`Configuration for year ${year} is not supported`)
    }
  } catch (error) {
    throw new Error(`Failed to load configuration for year ${year}: ${error}`)
  }
}

/**
 * Validate record specifications for business logic rules
 */
function validateRecordSpecs(records: RecordSpec[]): void {
  const recordTypes = new Set<string>()
  const orderIndices = new Set<number>()

  for (const record of records) {
    // Check for duplicate record types
    if (recordTypes.has(record.recordType)) {
      throw new Error(`Duplicate record type: ${record.recordType}`)
    }
    recordTypes.add(record.recordType)

    // Check for duplicate order indices
    if (orderIndices.has(record.orderIndex)) {
      throw new Error(`Duplicate order index: ${record.orderIndex}`)
    }
    orderIndices.add(record.orderIndex)

    // Validate field positions don't overlap
    validateFieldPositions(record)

    // Validate min/max occurs logic
    if (record.minOccurs !== undefined && record.maxOccurs !== undefined) {
      if (record.minOccurs > record.maxOccurs) {
        throw new Error(
          `Invalid occurs range for record ${record.recordType}: minOccurs (${record.minOccurs}) > maxOccurs (${record.maxOccurs})`
        )
      }
    }
  }
}

/**
 * Validate that field positions don't overlap within a record
 */
function validateFieldPositions(record: RecordSpec): void {
  const positions: Array<{ start: number; end: number; fieldCode: string }> = []

  for (const field of record.fields) {
    const end = field.start + field.length - 1

    // Check if field extends beyond record length
    if (end >= record.recordLength) {
      throw new Error(
        `Field ${field.fieldCode} in record ${record.recordType} extends beyond record length (${record.recordLength})`
      )
    }

    // Check for overlaps
    for (const pos of positions) {
      if (
        (field.start >= pos.start && field.start <= pos.end) ||
        (end >= pos.start && end <= pos.end) ||
        (field.start <= pos.start && end >= pos.end)
      ) {
        throw new Error(
          `Field ${field.fieldCode} overlaps with field ${pos.fieldCode} in record ${record.recordType}`
        )
      }
    }

    positions.push({ start: field.start, end, fieldCode: field.fieldCode })
  }
}

/**
 * Get list of supported years
 */
export function getSupportedYears(): number[] {
  return [2024]
}

// Re-export types for convenience
export type { SpecField, RecordSpec, YearSpec }
