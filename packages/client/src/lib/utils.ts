import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
