import React, { ComponentProps, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useMediaQuery } from '../../../hooks/use-media-query.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command.js';
import { Drawer, DrawerContent, DrawerTrigger } from '../../ui/drawer.js';
import { FormControl } from '../../ui/form.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.js';

type Datum = {
  value: string;
  label: string;
};

type ComboBoxProps = {
  data: Array<Datum>;
  placeholder?: string;
  triggerProps?: Omit<React.ComponentProps<typeof Button>, 'disabled'>;
  disabled?: boolean;
  onChange?: ((datum: string | null) => void) | undefined;
  value?: string | null;
  formPart?: boolean;
};

export function ComboBox({
  data,
  placeholder,
  triggerProps,
  disabled,
  onChange,
  value,
  formPart,
}: ComboBoxProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const selectedDatum = useMemo(() => {
    if (!value) return null;
    return data.find(datum => datum.value === value) || null;
  }, [value, data]);

  if (isDesktop) {
    return (
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Trigger
            placeholder={placeholder}
            selectedDatum={selectedDatum}
            disabled={disabled}
            formPart={formPart}
            {...triggerProps}
          />
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <DatumList
            setOpen={setOpen}
            onChange={onChange}
            data={data}
            placeholder={placeholder}
            value={value}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Trigger
          placeholder={placeholder}
          selectedDatum={selectedDatum}
          disabled={disabled}
          formPart={formPart}
          {...triggerProps}
        />
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t">
          <DatumList
            setOpen={setOpen}
            onChange={onChange}
            data={data}
            placeholder={placeholder}
            value={value}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type TriggerProps = ComponentProps<typeof Button> & {
  formPart?: boolean;
  placeholder?: string;
  selectedDatum: Datum | null;
};

function Trigger({ formPart, placeholder, selectedDatum, ...triggerProps }: TriggerProps) {
  if (formPart) {
    return (
      <FormControl>
        <Button variant="outline" className="w-full justify-start" {...triggerProps}>
          {selectedDatum ? selectedDatum.label : placeholder}
        </Button>
      </FormControl>
    );
  }
  return (
    <Button variant="outline" className="w-[150px] justify-start" {...triggerProps}>
      {selectedDatum ? selectedDatum.label : placeholder}
    </Button>
  );
}

function DatumList({
  setOpen,
  onChange,
  placeholder,
  data,
  value,
}: {
  setOpen: (open: boolean) => void;
  onChange?: (datum: string | null) => void;
  placeholder?: string;
  data: Array<Datum>;
  value?: string | null;
}) {
  return (
    <Command>
      <CommandInput placeholder={placeholder ?? 'Filter options...'} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          {data.map(datum => (
            <CommandItem
              key={datum.value}
              keywords={[datum.label]}
              value={datum.value}
              onSelect={value => {
                onChange?.(data.find(priority => priority.value === value)?.value ?? null);
                setOpen(false);
              }}
            >
              {datum.label}
              <Check
                className={cn('ml-auto', datum.value === value ? 'opacity-100' : 'opacity-0')}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
