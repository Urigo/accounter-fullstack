import { forwardRef, useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NumericFormat, type NumericFormatProps } from 'react-number-format';
import { Button } from '../../ui/button.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';

export interface NumberInputProps extends Omit<
  NumericFormatProps,
  'value' | 'onValueChange' | 'onChange'
> {
  stepper?: number;
  thousandSeparator?: string;
  placeholder?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  value?: number; // Controlled value
  suffix?: string;
  prefix?: string;
  onValueChange?: (value: number | undefined) => void;
  fixedDecimalScale?: boolean;
  decimalScale?: number;
  hideControls?: boolean;
  onChange?: (value: number | null | undefined) => void;
  /** Rendered above the field. Carried over from Mantine's `NumberInput`. */
  label?: ReactNode;
  /** Validation message rendered below the field, and wired to `aria-describedby`. */
  error?: ReactNode;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    stepper,
    thousandSeparator,
    placeholder,
    defaultValue,
    min = -Infinity,
    max = Infinity,
    onValueChange,
    fixedDecimalScale = false,
    decimalScale = 0,
    suffix,
    prefix,
    value: controlledValue,
    hideControls = false,
    onChange,
    label,
    error,
    id,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState<number | undefined>(controlledValue ?? defaultValue);

  const handleIncrement = useCallback(() => {
    setValue(prev => (prev === undefined ? (stepper ?? 1) : Math.min(prev + (stepper ?? 1), max)));
  }, [stepper, max]);

  const handleDecrement = useCallback(() => {
    setValue(prev => (prev === undefined ? -(stepper ?? 1) : Math.max(prev - (stepper ?? 1), min)));
  }, [stepper, min]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === (ref as React.RefObject<HTMLInputElement>)?.current) {
        if (e.key === 'ArrowUp') {
          handleIncrement();
        } else if (e.key === 'ArrowDown') {
          handleDecrement();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleIncrement, handleDecrement, ref]);

  useEffect(() => {
    if (controlledValue !== undefined) {
      setValue(controlledValue);
    }
  }, [controlledValue]);

  const handleChange = (values: { value: string; floatValue: number | undefined }) => {
    const newValue = values.floatValue === undefined ? undefined : values.floatValue;
    setValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
    onChange?.(newValue ?? undefined);
  };

  const handleBlur = () => {
    if (value !== undefined) {
      if (value < min) {
        setValue(min);
        (ref as React.RefObject<HTMLInputElement>).current!.value = String(min);
      } else if (value > max) {
        setValue(max);
        (ref as React.RefObject<HTMLInputElement>).current!.value = String(max);
      }
    }
  };

  const field = (
    <div className="flex items-center">
      <NumericFormat
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onValueChange={handleChange}
        thousandSeparator={thousandSeparator}
        decimalScale={decimalScale}
        fixedDecimalScale={fixedDecimalScale}
        allowNegative={min < 0}
        valueIsNumericString
        onBlur={handleBlur}
        max={max}
        min={min}
        suffix={suffix}
        prefix={prefix}
        customInput={Input}
        placeholder={placeholder}
        className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none relative ${hideControls ? '' : ' rounded-r-none'}`}
        getInputRef={ref}
        {...props}
      />

      {hideControls ? null : (
        <div className="flex flex-col">
          <Button
            aria-label="Increase value"
            className="px-2 h-5 rounded-l-none rounded-br-none border-input border-l-0 border-b-[0.5px] focus-visible:relative"
            variant="outline"
            onClick={handleIncrement}
            disabled={value === max}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            aria-label="Decrease value"
            className="px-2 h-5 rounded-l-none rounded-tr-none border-input border-l-0 border-t-[0.5px] focus-visible:relative"
            variant="outline"
            onClick={handleDecrement}
            disabled={value === min}
          >
            <ChevronDown size={15} />
          </Button>
        </div>
      )}
    </div>
  );

  // Label and error are only wrapped when asked for, so existing call sites that render
  // their own FormLabel/FormMessage keep exactly the markup they had.
  if (!label && !error) {
    return field;
  }

  return (
    <div className="w-full">
      {label ? (
        <Label htmlFor={inputId} className="mb-1">
          {label}
        </Label>
      ) : null}
      {field}
      {error ? (
        <p id={errorId} className="text-destructive mt-1 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
});
