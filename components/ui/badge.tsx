import * as React from 'react';
import { cn } from '@/lib/utils';

/* Badge = label kecil berwarna untuk menandai jenis/kategori. */

type Tone = 'neutral' | 'income' | 'expense' | 'info' | 'warning';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  income: 'bg-success/10 text-success ring-1 ring-inset ring-success/25',
  expense: 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25',
  info: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25',
  warning: 'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
