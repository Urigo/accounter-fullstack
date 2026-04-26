import { z } from 'zod';

const dynamicReportNodeData = z
  .object({
    nodeType: z.enum(['synthetic-branch', 'sort-code-branch', 'financial-entity']),
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

// ── Legacy format ──────────────────────────────────────────────────────────────

const legacyDynamicReportNodeData = z
  .object({
    descendantSortCodes: z.union([z.array(z.number()), z.null()]).optional(),
    descendantFinancialEntities: z.union([z.array(z.string().uuid()), z.null()]).optional(),
    mergedSortCodes: z.union([z.array(z.number()), z.null()]).optional(),
    sortCode: z.number().optional(),
    isOpen: z.boolean(),
    hebrewText: z.string().optional(),
  })
  .loose();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const legacyDynamicReportNode = z
  .object({
    id: z.union([z.string(), z.number()]),
    parent: z.union([z.string(), z.number()]),
    text: z.string(),
    droppable: z.boolean(),
    data: legacyDynamicReportNodeData,
  })
  .loose();

type LegacyDynamicReportNode = z.infer<typeof legacyDynamicReportNode>;

/**
 * Returns true when the raw parsed node array contains at least one node
 * whose `data` object has a `descendantSortCodes` key — the hallmark of the
 * old implicit-membership format.
 */
export function isLegacyTemplate(nodes: unknown[]): boolean {
  return nodes.some(
    node =>
      node !== null &&
      typeof node === 'object' &&
      'data' in node &&
      node.data !== null &&
      typeof node.data === 'object' &&
      'descendantSortCodes' in node.data,
  );
}

/**
 * Converts a legacy template (implicit-membership format) to the new
 * explicit-leaf format given the set of live financial entity IDs that belong
 * to each sort code.
 *
 * @param nodes            Parsed legacy node array (validated against the old schema)
 * @param entityBySortCode Map<sortCodeId, string[]> — entity UUIDs that belong to that sort code
 * @returns                Node array in the new explicit format (no hint arrays, explicit leaf nodes)
 */
export function migrateLegacyTemplate(
  nodes: LegacyDynamicReportNode[],
  entityBySortCode: Map<string | number, string[]>,
): DynamicReportNodeType[] {
  const result: DynamicReportNodeType[] = [];
  const explicitLeafIds = new Set<string>();
  const sortCodesWithExplicitNode = new Set<number>();

  // Pre-pass: collect existing explicit leaf IDs and sort codes that already
  // have a dedicated branch node in the legacy template.
  for (const node of nodes) {
    if (!node.droppable) {
      explicitLeafIds.add(String(node.id));
    } else if ('sortCode' in node.data && node.data.sortCode != null) {
      sortCodesWithExplicitNode.add(node.data.sortCode);
    }
  }

  // Main pass: migrate branch nodes and inject missing leaf nodes.
  for (const node of nodes) {
    if (node.droppable) {
      const hasSortCode = 'sortCode' in node.data && node.data.sortCode != null;
      const nodeType: DynamicReportNodeDataType['nodeType'] = hasSortCode
        ? 'sort-code-branch'
        : 'synthetic-branch';

      result.push({
        id: node.id,
        parent: node.parent,
        text: node.text,
        droppable: true,
        data: {
          nodeType,
          isOpen: node.data.isOpen,
          ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
        },
      });

      // Inject explicit leaf nodes from descendantFinancialEntities.
      const entities = node.data.descendantFinancialEntities ?? [];
      for (const uuid of entities) {
        if (!explicitLeafIds.has(uuid)) {
          explicitLeafIds.add(uuid);
          result.push({
            id: uuid,
            parent: node.id,
            text: uuid,
            droppable: false,
            data: { nodeType: 'financial-entity', isOpen: false },
          });
        }
      }

      // Inject explicit leaf nodes for descendant sort codes that have no
      // dedicated branch node in the legacy template. Their entities are
      // resolved via the entityBySortCode map supplied by the caller.
      for (const sc of node.data.descendantSortCodes ?? []) {
        if (sortCodesWithExplicitNode.has(sc)) continue;
        for (const uuid of entityBySortCode.get(sc) ?? []) {
          if (!explicitLeafIds.has(uuid)) {
            explicitLeafIds.add(uuid);
            result.push({
              id: uuid,
              parent: node.id,
              text: uuid,
              droppable: false,
              data: { nodeType: 'financial-entity', isOpen: false },
            });
          }
        }
      }
    } else {
      // Existing explicit leaf — migrate data shape.
      result.push({
        id: node.id,
        parent: node.parent,
        text: node.text,
        droppable: false,
        data: {
          nodeType: 'financial-entity',
          isOpen: node.data.isOpen,
          ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
        },
      });
    }
  }

  return result;
}
