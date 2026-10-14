import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

/**
 * Ikon panah (chevron) untuk dropdown.
 * Dipasang lewat inline style, BUKAN lewat class Tailwind seperti
 * `bg-[length:16px]` / `bg-[right_0.6rem_center]`.
 *
 * Alasannya penting: helper `cn()` memakai tailwind-merge, yang menganggap
 * class `bg-[...]` sebagai "background-color" dan akan MEMBUANG `bg-card`.
 * Akibatnya elemen tidak punya background-color, browser memakai default
 * `<select>` yang berwarna PUTIH, dan di mode gelap teksnya jadi tak terbaca.
 */
const CHEVRON_ICON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, style, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{
        backgroundImage: CHEVRON_ICON,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
        backgroundSize: '16px',
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-foreground/90', className)}
      {...props}
    />
  );
}

/** Pesan error kecil di bawah input. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs font-medium text-destructive">{children}</p>;
}
