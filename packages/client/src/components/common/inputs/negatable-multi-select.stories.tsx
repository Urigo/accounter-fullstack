import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog, DialogContent, DialogTitle } from '../../ui/dialog.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { NegatableMultiSelect } from './negatable-multi-select.js';

const BUSINESSES = [
  { value: 'acme', label: 'Acme Ltd' },
  { value: 'globex', label: 'Globex Corporation' },
  { value: 'initech', label: 'Initech' },
  { value: 'umbrella', label: 'Umbrella Corp' },
  { value: 'hooli', label: 'Hooli' },
];

/**
 * Replaced Mantine's `MultiSelect`. The filter dialogs use the default, non-negatable
 * mode — a plain controlled multi-select — while the charges filters use `negatable` for
 * the include/exclude tri-state. Both modes are covered here because the four migrated
 * filter dialogs are the first consumers of the non-negatable one.
 */
function Harness(props: Partial<Parameters<typeof NegatableMultiSelect>[0]>): ReactElement {
  const [value, setValue] = useState<string[]>(props.value ?? []);
  const [excluded, setExcluded] = useState<string[]>(props.excludedValue ?? []);
  return (
    <div className="w-80 p-6">
      <NegatableMultiSelect
        options={BUSINESSES}
        placeholder="Scroll to see all options"
        {...props}
        value={value}
        onValueChange={setValue}
        excludedValue={excluded}
        onExcludedChange={setExcluded}
      />
    </div>
  );
}

const meta = {
  title: 'Inputs/NegatableMultiSelect',
  component: Harness,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the migrated filter dialogs render: `negatable` left at its `false` default. */
export const Default: Story = { args: {} };

export const WithValue: Story = { args: { value: ['acme', 'globex'] } };

/** Past `maxVisibleChips` the rest collapse into a "+N more" badge with a tooltip. */
export const OverflowingSelection: Story = {
  args: { value: ['acme', 'globex', 'initech', 'umbrella'] },
};

/** Mantine disabled the input while its `data` was still fetching; `loading` also labels why. */
export const Loading: Story = { args: { options: [], loading: true } };

export const Disabled: Story = { args: { value: ['acme'], disabled: true } };

/** The include/exclude tri-state, used by the charges filters. */
export const Negatable: Story = {
  args: { negatable: true, value: ['acme'], excludedValue: ['initech'] },
};

/**
 * How the filter dialogs wire it up: inside `FormControl`, which injects `id`,
 * `aria-describedby` and `aria-invalid` onto the trigger.
 */
export const AsFormPart: Story = {
  render: function Render() {
    const form = useForm<{ businessIDs: string[] }>({ defaultValues: { businessIDs: [] } });
    return (
      <div className="w-80 p-6">
        <Form {...form}>
          <FormField
            control={form.control}
            name="businessIDs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Businesses</FormLabel>
                <FormControl>
                  <NegatableMultiSelect
                    ref={field.ref}
                    onBlur={field.onBlur}
                    options={BUSINESSES}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Scroll to see all options"
                    aria-label="Businesses"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </div>
    );
  },
};

const MANY_OPTIONS = Array.from({ length: 40 }, (_, index) => ({
  value: `business-${index}`,
  label: `Business number ${index + 1}`,
}));

/** The list is capped at 300px; anything past that has to be reachable by scrolling. */
export const ManyOptions: Story = { args: { options: MANY_OPTIONS } };

/**
 * The list is capped at 300px and scrolls. This is the case that used to be broken: every
 * consumer renders inside a Radix `Dialog`, whose `RemoveScroll` cancels wheel events outside
 * the dialog content — and the popover portals to `document.body` by default, which is outside.
 */
export const InsideDialogWithManyOptions: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Dialog open modal>
        <DialogContent className="max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogTitle>Filters</DialogTitle>
          <NegatableMultiSelect
            options={MANY_OPTIONS}
            value={value}
            onValueChange={setValue}
            placeholder="Scroll to see all options"
            aria-label="Businesses"
          />
        </DialogContent>
      </Dialog>
    );
  },
};
