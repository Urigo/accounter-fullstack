import type { DocumentsModule } from '../types.js';

export const fetchEmailDocument: DocumentsModule.MutationResolvers['fetchEmailDocument'] = (
  _,
  { url },
) => {
  // TODO: implement

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return url as any;
};
