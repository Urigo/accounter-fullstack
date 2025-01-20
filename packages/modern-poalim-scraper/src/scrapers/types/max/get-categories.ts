import { z } from 'zod';

const resultSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const maxCategoriesSchema = z.object({
  result: z.array(resultSchema),
});
