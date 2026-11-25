import { useCallback } from 'react';
import type { Report1214ProfileInput } from '../../../../../gql/graphql.js';
import { useUpdateReport1214Profile } from '../../../../../hooks/use-update-report-1214-profile.js';
import { useForm1214Report } from '../report-context.js';

/**
 * Saves profile blocks of the page's year, then refreshes the report so its validation and
 * amounts follow. Resolves to whether the save succeeded (failures are shown in a toast).
 */
export function useSaveProfileBlock(): {
  saving: boolean;
  save: (input: Report1214ProfileInput, blockName: string) => Promise<boolean>;
} {
  const { year, refresh } = useForm1214Report();
  const { fetching, updateReport1214Profile } = useUpdateReport1214Profile();
  const save = useCallback(
    async (input: Report1214ProfileInput, blockName: string) => {
      const saved = await updateReport1214Profile({ year, input }, blockName);
      if (saved) {
        refresh();
      }
      return saved;
    },
    [year, refresh, updateReport1214Profile],
  );
  return { saving: fetching, save };
}
