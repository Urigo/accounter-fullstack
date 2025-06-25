import { describe, expect, it } from 'vitest'
import { getSpecForYear, getSupportedYears } from '../../src/config/loader.js'

describe('config-loader', () => {
  describe('getSpecForYear', () => {
    it('should load configuration for year 2024', async () => {
      const records = await getSpecForYear(2024)

      expect(records).toBeInstanceOf(Array)
      expect(records).toHaveLength(1)

      const record = records[0]
      expect(record.recordType).toBe('1000')
      expect(record.recordLength).toBe(50)
      expect(record.repeatable).toBe(false)
      expect(record.orderIndex).toBe(1)
      expect(record.fields).toHaveLength(5)

      // Validate first field
      const firstField = record.fields[0]
      expect(firstField.fieldCode).toBe('1000_01')
      expect(firstField.fieldName).toBe('exampleStringField')
      expect(firstField.start).toBe(0)
      expect(firstField.length).toBe(10)
      expect(firstField.type).toBe('string')
      expect(firstField.required).toBe(true)
      expect(firstField.padding).toBe('right')
      expect(firstField.rtl).toBe(false)

      // Validate second field
      const secondField = record.fields[1]
      expect(secondField.fieldCode).toBe('1000_02')
      expect(secondField.fieldName).toBe('exampleNumberField')
      expect(secondField.start).toBe(10)
      expect(secondField.length).toBe(5)
      expect(secondField.type).toBe('number')
      expect(secondField.required).toBe(true)
      expect(secondField.padding).toBe('left')

      // Validate date field
      const dateField = record.fields[2]
      expect(dateField.fieldCode).toBe('1000_03')
      expect(dateField.type).toBe('date')
      expect(dateField.format).toBe('YYYYMMDD')
      expect(dateField.required).toBe(false)

      // Validate Hebrew field
      const hebrewField = record.fields[3]
      expect(hebrewField.fieldCode).toBe('1000_04')
      expect(hebrewField.rtl).toBe(true)
      expect(hebrewField.required).toBe(false)

      // Validate enum field
      const enumField = record.fields[4]
      expect(enumField.fieldCode).toBe('1000_05')
      expect(enumField.enumValues).toEqual(['01', '02', '03'])
      expect(enumField.defaultValue).toBe('01')
    })

    it('should throw error for unsupported year', async () => {
      await expect(getSpecForYear(2023)).rejects.toThrow(
        'Configuration for year 2023 is not supported. Available years: 2024'
      )
    })

    it('should throw error for invalid year format', async () => {
      await expect(getSpecForYear(NaN)).rejects.toThrow()
    })

    it('should validate field positions do not overlap', async () => {
      // This test would require creating an invalid config file
      // For now, we'll test that our current config is valid
      const records = await getSpecForYear(2024)
      expect(records).toBeDefined()

      // Verify fields don't overlap
      const record = records[0]
      const positions = record.fields.map(field => ({
        start: field.start,
        end: field.start + field.length - 1,
        fieldCode: field.fieldCode,
      }))

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pos1 = positions[i]
          const pos2 = positions[j]

          const overlaps =
            (pos1.start >= pos2.start && pos1.start <= pos2.end) ||
            (pos1.end >= pos2.start && pos1.end <= pos2.end) ||
            (pos1.start <= pos2.start && pos1.end >= pos2.end)

          expect(overlaps).toBe(false)
        }
      }
    })

    it('should validate all fields are within record length', async () => {
      const records = await getSpecForYear(2024)
      const record = records[0]

      for (const field of record.fields) {
        const fieldEnd = field.start + field.length - 1
        expect(fieldEnd).toBeLessThan(record.recordLength)
      }
    })
  })

  describe('getSupportedYears', () => {
    it('should return array of supported years', () => {
      const years = getSupportedYears()
      expect(years).toBeInstanceOf(Array)
      expect(years).toContain(2024)
      expect(years.length).toBeGreaterThan(0)
    })
  })
})
