import { useCallback } from 'react';
import type { Report1214ProfileInput } from '../../../../../gql/graphql.js';
import { useUpdateReport1214ProfileBlocks } from '../../../../../hooks/use-update-report-1214-profile-blocks.js';
import { useForm1214Report } from '../report-context.js';

/**
 * Saves profile blocks of the page's year, then refreshes the report so its validation and
 * amounts follow. Resolves to whether the save succeeded (failures are shown in a toast).
 */
export function useSaveProfileBlock(): {
  saving: boolean;
  save: (input: Report1214ProfileInput, blockLabel: string) => Promise<boolean>;
} {
  const { year, refresh } = useForm1214Report();
  const { fetching, updateProfileBlocks } = useUpdateReport1214ProfileBlocks();
  const save = useCallback(
    async (input: Report1214ProfileInput, blockLabel: string) => {
      const saved = await updateProfileBlocks({ year, input, blockLabel });
      if (saved) {
        refresh();
      }
      return saved;
    },
    [year, refresh, updateProfileBlocks],
  );
  return { saving: fetching, save };
}
