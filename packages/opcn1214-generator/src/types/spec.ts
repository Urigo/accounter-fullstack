/**
 * Field specification for OPCN 1214 records
 */
export interface SpecField {
  /** Unique field code identifier (e.g., "1000_01") */
  fieldCode: string
  /** Human-readable field name */
  fieldName: string
  /** 0-based start position in the fixed-width record */
  start: number
  /** Field length in characters */
  length: number
  /** Data type of the field */
  type: 'string' | 'number' | 'date'
  /** Whether this field is required */
  required: boolean
  /** Optional format pattern (e.g., "YYYYMMDD" for dates) */
  format?: string
  /** True if field contains Hebrew text (right-to-left) */
  rtl?: boolean
  /** Allowed enum values for validation */
  enumValues?: string[]
  /** Default value if field is not provided */
  defaultValue?: string | number | null
  /** Padding direction for the field */
  padding?: 'left' | 'right'
  /** Field description for documentation */
  description?: string
}

/**
 * Record specification for OPCN 1214 records
 */
export interface RecordSpec {
  /** Record type identifier (e.g., "1000") */
  recordType: string
  /** Total record length in characters */
  recordLength: number
  /** Whether this record type can appear multiple times */
  repeatable: boolean
  /** Minimum number of occurrences (optional) */
  minOccurs?: number
  /** Maximum number of occurrences (optional) */
  maxOccurs?: number
  /** Order index for record sequence validation */
  orderIndex: number
  /** Array of field specifications for this record */
  fields: SpecField[]
  /** Record description for documentation */
  description?: string
}

/**
 * Complete specification for a tax year
 */
export interface YearSpec {
  /** Tax year */
  year: number
  /** Array of record specifications */
  records: RecordSpec[]
}
