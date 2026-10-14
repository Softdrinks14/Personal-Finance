'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn, uid } from '@/lib/utils';

/**
 * Notifikasi kecil di pojok kanan bawah ("toast").
 * Dipakai untuk memberi kabar: "Transaksi tersimpan", "Gagal menghapus", dll.
 */

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/30 bg-card text-foreground',
  error: 'border-destructive/30 bg-card text-foreground',
  info: 'border-border bg-card text-foreground',
};

const toneIcons: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertTriangle className="h-4 w-4 text-destructive" />,
  info: <Info className="h-4 w-4 text-primary" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ title, description, tone = 'info' }) => {
      const id = uid();
      setItems((prev) => [...prev, { id, title, description, tone }]);
      // Hilang otomatis setelah 4 detik.
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-soft animate-slide-up',
              toneStyles[item.tone],
            )}
          >
            <span className="mt-0.5">{toneIcons[item.tone]}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => remove(item.id)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Fallback supaya komponen tidak crash kalau lupa dibungkus ToastProvider.
    return { toast: () => undefined };
  }
  return context;
}
