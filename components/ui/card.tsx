import * as React from 'react';
import { cn } from '@/lib/utils';

/* Kartu = kotak putih dengan sudut membulat, dipakai untuk membungkus konten. */

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // min-w-0 itu penting, bukan hiasan:
        // Kalau Card dipakai sebagai anak grid/flex, browser secara default
        // memberi `min-width: auto` yang artinya "jangan menyusut di bawah
        // lebar minimum isinya". Untuk tabel yang selnya `whitespace-nowrap`,
        // lebar minimum itu bisa lebih besar dari layar HP — akibatnya kartu
        // memaksa kolom grid jadi lebih lebar dan garisnya keluar dari layar.
        // Dengan min-width: 0, kartu mau menyusut dan tabelnya yang menggeser
        // (scroll) di dalam kotaknya sendiri.
        'min-w-0 rounded-lg border border-border bg-card text-card-foreground shadow-soft',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 border-b border-border/60 px-5 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold leading-tight tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 border-t border-border/60 px-5 py-4', className)} {...props} />;
}
