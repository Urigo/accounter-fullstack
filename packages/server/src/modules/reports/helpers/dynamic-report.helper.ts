import { z } from 'zod';

const dynamicReportNodeData = z
  .object({
    descendantSortCodes: z.array(z.number()).optional(),
    descendantFinancialEntities: z.array(z.string()).optional(),
    mergedSortCodes: z.array(z.number()).optional(),
    isOpen: z.boolean(),
    hebrewText: z.string().optional(),
  })
  .strict();

const dynamicReportNode = z
  .object({
    id: z.union([z.string(), z.number()]),
    parent: z.union([z.string(), z.number()]),
    text: z.string(),
    droppable: z.boolean(),
    data: dynamicReportNodeData,
  })
  .strict();

export const dynamicReportTemplate = z.array(dynamicReportNode);

export type DynamicReportNodeType = z.infer<typeof dynamicReportNode>;

export type DynamicReportNodeDataType = z.infer<typeof dynamicReportNodeData>;

export function parseTemplate(raw: string) {
  const parsed = JSON.parse(raw);
  return dynamicReportTemplate.parse(parsed);
}

export function validateTemplate(raw: string) {
  const parsed = JSON.parse(raw);
  const validated = dynamicReportTemplate.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Error validating report template: ${validated.error}`);
  }
  return true;
}
