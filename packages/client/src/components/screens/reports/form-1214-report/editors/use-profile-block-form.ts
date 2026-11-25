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
  /** The profile input to send; called with valid values only. */
  toInput: (values: T) => Report1214ProfileInput;
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
    if (await save(toInput(values), blockName)) {
      // What was sent shows until the refreshed report replaces it
      markSaved(values);
    }
  });

  return { form, saving, onSubmit, cancel };
}
