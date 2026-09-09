import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { ComboBox } from './combo-box.js';

const TAX_CATEGORIES = [
  { value: 'rd', label: 'Research & Development' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'travel', label: 'Travel' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'consulting', label: 'Consulting', description: 'Income from consulting work' },
];

/**
 * Replaced Mantine's `Select`. `label`, `form` and `required` were added for that migration:
 * Mantine rendered a label, and the depreciation and balance-charge forms rely on `form` and
 * `required` to associate a trigger with a form rendered outside it.
 */
function Harness(props: Partial<Parameters<typeof ComboBox>[0]>): ReactElement {
  const [value, setValue] = useState<string | null>(props.value ?? null);
  return (
    <div className="w-80 p-6">
      <ComboBox
        data={TAX_CATEGORIES}
        placeholder="Scroll to see all options"
        {...props}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: 'Inputs/ComboBox',
  component: Harness,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

/** The label is the prop added for the Mantine `Select` migration. */
export const WithLabel: Story = { args: { label: 'Tax category' } };

export const WithValue: Story = { args: { label: 'Tax category', value: 'marketing' } };

/** Rendered outside a form field, the error message sits below the trigger. */
export const WithError: Story = {
  args: { label: 'Tax category', error: 'Tax category is required' },
};

export const Disabled: Story = { args: { label: 'Tax category', disabled: true } };

/**
 * `formPart` is what the react-hook-form call sites pass: it renders the trigger inside a
 * `FormControl` and makes it full width rather than the default fixed 150px.
 *
 * It therefore only works inside a form — `FormControl` calls `useFormContext()` and throws
 * outright without one. This story wires up a real `useForm` for that reason; the portable
 * stories test caught the version that did not.
 */
export const AsFormPart: Story = {
  render: function Render() {
    const form = useForm<{ taxCategory: string | null }>({
      defaultValues: { taxCategory: null },
    });
    return (
      <div className="w-80 p-6">
        <Form {...form}>
          <FormField
            control={form.control}
            name="taxCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax category</FormLabel>
                <ComboBox
                  data={TAX_CATEGORIES}
                  placeholder="Scroll to see all options"
                  value={field.value}
                  onChange={field.onChange}
                  formPart
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </div>
    );
  },
};
