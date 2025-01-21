import { z } from 'zod';

const resultImageSchema = z
  .object({
    alt: z.string(),
    url: z.string(),
  })
  .strict();

const resultSchema = z
  .object({
    color: z.string(),
    id: z.number(),
    image: resultImageSchema,
    name: z.string(),
    roundImage: resultImageSchema,
  })
  .strict();

export const maxCategoriesSchema = z
  .object({
    correlationID: z.string(),
    rcDesc: z.null(),
    result: z.array(resultSchema),
    returnCode: z.number(),
  })
  .strict();
