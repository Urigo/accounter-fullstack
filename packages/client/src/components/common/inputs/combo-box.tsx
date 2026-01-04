import React, { useMemo, type ComponentProps } from 'react';
import { Check, ChevronDownIcon } from 'lucide-react';
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

type Option = {
  value: string;
  label: string;
  description?: string;
};

type ComboBoxProps = {
  data: Array<Option>;
  placeholder?: string;
  triggerProps?: Omit<React.ComponentProps<typeof Button>, 'disabled'>;
  disabled?: boolean;
  onChange?: ((option: string | null) => void) | undefined;
  value?: string | null;
  formPart?: boolean;
  error?: string;
};

export function ComboBox({
  data,
  placeholder,
  triggerProps,
  disabled,
  onChange,
  value,
  formPart,
  error,
}: ComboBoxProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return data.find(option => option.value === value) || null;
  }, [value, data]);

  if (isDesktop) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <Popover modal open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild className="w-fit min-w-40">
            <Trigger
              placeholder={placeholder}
              selectedOption={selectedOption}
              disabled={disabled}
              formPart={formPart}
              {...triggerProps}
            />
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <OptionsList
              setOpen={setOpen}
              onChange={onChange}
              data={data}
              placeholder={placeholder}
              value={value}
            />
          </PopoverContent>
        </Popover>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Trigger
            placeholder={placeholder}
            selectedOption={selectedOption}
            disabled={disabled}
            formPart={formPart}
            {...triggerProps}
          />
        </DrawerTrigger>
        <DrawerContent>
          <div className="mt-4 border-t">
            <OptionsList
              setOpen={setOpen}
              onChange={onChange}
              data={data}
              placeholder={placeholder}
              value={value}
            />
          </div>
        </DrawerContent>
      </Drawer>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

type TriggerProps = ComponentProps<typeof Button> & {
  formPart?: boolean;
  placeholder?: string;
  selectedOption: Option | null;
};

function Trigger({ formPart, placeholder, selectedOption, ...triggerProps }: TriggerProps) {
  if (formPart) {
    return (
      <FormControl>
        <Button variant="outline" className="w-full justify-start" {...triggerProps}>
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronDownIcon
            strokeWidth={2}
            className="shrink-0 text-gray-500/80 dark:text-gray-400/80 size-4"
            aria-hidden="true"
          />
        </Button>
      </FormControl>
    );
  }
  return (
    <Button variant="outline" className="w-[150px] justify-start" {...triggerProps}>
      {selectedOption ? selectedOption.label : placeholder}
      <ChevronDownIcon
        strokeWidth={2}
        className="shrink-0 text-gray-500/80 dark:text-gray-400/80 size-4"
        aria-hidden="true"
      />
    </Button>
  );
}

function OptionsList({
  setOpen,
  onChange,
  placeholder,
  data,
  value,
}: {
  setOpen: (open: boolean) => void;
  onChange?: (option: string | null) => void;
  placeholder?: string;
  data: Array<Option>;
  value?: string | null;
}) {
  return (
    <Command>
      <CommandInput placeholder={placeholder ?? 'Filter options...'} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          {data.map(option => (
            <CommandItem
              key={option.value}
              keywords={[option.label, option.description ?? '']}
              value={option.value}
              onSelect={value => {
                onChange?.(
                  data.find(option => option.value.toLowerCase() === value.toLowerCase())?.value ??
                    null,
                );
                setOpen(false);
              }}
            >
              <div className="flex flex-col">
                {option.description && (
                  <span className="text-xs opacity-65">{option.description}</span>
                )}
                <span>{option.label}</span>
              </div>
              <Check
                className={cn('ml-auto', option.value === value ? 'opacity-100' : 'opacity-0')}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
