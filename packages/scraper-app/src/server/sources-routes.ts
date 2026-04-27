import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getVault, isLocked, updateVault } from './vault-store.js';
import {
  CalAccountSchema,
  DiscountAccountSchema,
  IsracardAmexAccountSchema,
  MaxAccountSchema,
  PoalimAccountSchema,
  type Vault,
} from './vault.js';

const SourceConfigSchema = z.discriminatedUnion('type', [
  PoalimAccountSchema.extend({ type: z.literal('poalim') }),
  DiscountAccountSchema.extend({ type: z.literal('discount') }),
  IsracardAmexAccountSchema.extend({ type: z.literal('isracard') }),
  IsracardAmexAccountSchema.extend({ type: z.literal('amex') }),
  CalAccountSchema.extend({ type: z.literal('cal') }),
  MaxAccountSchema.extend({ type: z.literal('max') }),
]);

export type SourceConfig = z.infer<typeof SourceConfigSchema>;
type SourceType = SourceConfig['type'];

function collectSources(vault: Vault): SourceConfig[] {
  return [
    ...vault.poalimAccounts.map(a => ({ ...a, type: 'poalim' as const })),
    ...vault.discountAccounts.map(a => ({ ...a, type: 'discount' as const })),
    ...vault.isracardAccounts.map(a => ({ ...a, type: 'isracard' as const })),
    ...vault.amexAccounts.map(a => ({ ...a, type: 'amex' as const })),
    ...vault.calAccounts.map(a => ({ ...a, type: 'cal' as const })),
    ...vault.maxAccounts.map(a => ({ ...a, type: 'max' as const })),
  ];
}

function appendSource(vault: Vault, source: SourceConfig): Vault {
  const { type, ...rest } = source;
  const v = { ...vault };
  switch (type) {
    case 'poalim':
      v.poalimAccounts = [...vault.poalimAccounts, rest as (typeof vault.poalimAccounts)[number]];
      break;
    case 'discount':
      v.discountAccounts = [
        ...vault.discountAccounts,
        rest as (typeof vault.discountAccounts)[number],
      ];
      break;
    case 'isracard':
      v.isracardAccounts = [
        ...vault.isracardAccounts,
        rest as (typeof vault.isracardAccounts)[number],
      ];
      break;
    case 'amex':
      v.amexAccounts = [...vault.amexAccounts, rest as (typeof vault.amexAccounts)[number]];
      break;
    case 'cal':
      v.calAccounts = [...vault.calAccounts, rest as (typeof vault.calAccounts)[number]];
      break;
    case 'max':
      v.maxAccounts = [...vault.maxAccounts, rest as (typeof vault.maxAccounts)[number]];
      break;
  }
  return v;
}

type ArrayKey = Extract<
  keyof Vault,
  | 'poalimAccounts'
  | 'discountAccounts'
  | 'isracardAccounts'
  | 'amexAccounts'
  | 'calAccounts'
  | 'maxAccounts'
>;

const typeToKey: Record<SourceType, ArrayKey> = {
  poalim: 'poalimAccounts',
  discount: 'discountAccounts',
  isracard: 'isracardAccounts',
  amex: 'amexAccounts',
  cal: 'calAccounts',
  max: 'maxAccounts',
};

const typeToPatchSchema: Record<SourceType, z.ZodType> = {
  poalim: PoalimAccountSchema.omit({ id: true }).partial(),
  discount: DiscountAccountSchema.omit({ id: true }).partial(),
  isracard: IsracardAmexAccountSchema.omit({ id: true }).partial(),
  amex: IsracardAmexAccountSchema.omit({ id: true }).partial(),
  cal: CalAccountSchema.omit({ id: true }).partial(),
  max: MaxAccountSchema.omit({ id: true }).partial(),
};

function findSourceKey(
  vault: Vault,
  id: string,
): { key: ArrayKey; idx: number; type: SourceType } | null {
  for (const [type, key] of Object.entries(typeToKey) as [SourceType, ArrayKey][]) {
    const arr = vault[key] as Array<{ id: string }>;
    const idx = arr.findIndex(a => a.id === id);
    if (idx !== -1) return { key, idx, type };
  }
  return null;
}

function patchSource(
  vault: Vault,
  found: { key: ArrayKey; idx: number },
  patch: Record<string, unknown>,
): Vault {
  const { key, idx } = found;
  const arr = vault[key] as Array<{ id: string }>;
  const newArr = [...arr];
  newArr[idx] = { ...arr[idx], ...patch } as (typeof newArr)[number];
  return { ...vault, [key]: newArr };
}

function removeSource(vault: Vault, id: string): Vault | null {
  const found = findSourceKey(vault, id);
  if (!found) return null;

  const { key } = found;
  const arr = vault[key] as Array<{ id: string }>;
  return { ...vault, [key]: arr.filter(a => a.id !== id) };
}

function guardLocked(reply: { status(code: number): { send(body: unknown): unknown } }) {
  if (isLocked()) {
    return reply.status(401).send({ error: 'vault-locked' });
  }
  return null;
}

export async function registerSourcesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/vault/sources', async (_req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;
    return collectSources(getVault());
  });

  app.post<{ Body: SourceConfig }>('/api/vault/sources', async (req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;

    const parsed = SourceConfigSchema.safeParse({ ...req.body, id: randomUUID() });
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues });

    await updateVault(v => appendSource(v, parsed.data));
    return collectSources(getVault());
  });

  app.put<{ Params: { id: string }; Body: unknown }>(
    '/api/vault/sources/:id',
    async (req, reply) => {
      const blocked = guardLocked(reply);
      if (blocked) return blocked;

      const found = findSourceKey(getVault(), req.params.id);
      if (!found) return reply.status(404).send({ error: 'not-found' });

      const parsed = typeToPatchSchema[found.type].safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues });

      await updateVault(v => patchSource(v, found, parsed.data as Record<string, unknown>));
      return collectSources(getVault());
    },
  );

  app.delete<{ Params: { id: string } }>('/api/vault/sources/:id', async (req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;

    const updated = removeSource(getVault(), req.params.id);
    if (!updated) return reply.status(404).send({ error: 'not-found' });

    await updateVault(() => updated);
    return collectSources(getVault());
  });
}
