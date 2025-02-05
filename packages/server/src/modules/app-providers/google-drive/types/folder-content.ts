import { z } from 'zod';

const fileSchema = z.object({
  kind: z.string(),
  mimeType: z.string(),
  id: z.string(),
  name: z.string(),
});

export type DriveFileContent = z.infer<typeof fileSchema>;

const filesSchema = z.array(fileSchema);

export const folderContentSchema = z.object({
  files: filesSchema,
  kind: z.string(),
  incompleteSearch: z.boolean(),
});

export type DriveFolderContent = z.infer<typeof folderContentSchema>;
