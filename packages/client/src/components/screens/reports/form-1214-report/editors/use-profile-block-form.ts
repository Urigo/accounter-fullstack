import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import type { Report1214ProfileInput } from '../../../../../gql/graphql.js';
import { useReportDirtyState, useResetAfterSave } from '../profile-editor-parts.js';
import { useSaveProfileBlock } from './use-save-profile-block.js';

/**
 * The react-hook-form setup every 1214 profile block editor shares: errors show once a field is
 * left, and all of them (with the first invalid field focused) on Save; the dirty state is
 * reported to the page; Save sends the whole block, then refreshes the report.
 */
export function useProfileBlockForm<T extends FieldValues>({
  section,
  blockName,
  defaults,
  resolver,
  toInput,
}: {
  /** The page's dirty-state key. */
  section: string;
  /** What is saved, for the notifications. */
  blockName: string;
  /** The form state of the saved block; a new value is the refreshed report. */
  defaults: T;
  resolver: Resolver<T>;
  /**
   * The profile input to send; called with valid values only. `null` means the values could not
   * be turned into input after all: nothing is sent, since a block is replaced whole and a
   * fallback would wipe what is stored.
   */
  toInput: (values: T) => Report1214ProfileInput | null;
}) {
  const form = useForm<T>({
    mode: 'onTouched',
    resolver,
    defaultValues: defaults as DefaultValues<T>,
  });
  // A refreshed report resets the form only while it holds no unsaved edits
  const { markSaved, cancel } = useResetAfterSave(form, defaults);
  const { saving, save } = useSaveProfileBlock();
  useReportDirtyState(section, form.formState.isDirty);

  const onSubmit = form.handleSubmit(async values => {
    const input = toInput(values);
    if (!input) {
      console.error(`Form 1214 ${blockName}: the validated values could not be saved`, values);
      return;
    }
    if (await save(input, blockName)) {
      // What was sent shows until the refreshed report replaces it
      markSaved(values);
    }
  });

  return { form, saving, onSubmit, cancel };
}
