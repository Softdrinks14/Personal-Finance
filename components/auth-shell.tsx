'use client';

import * as React from 'react';
import { ShieldCheck, Wallet } from 'lucide-react';
import { SupabaseSetupNotice } from '@/components/supabase-setup-notice';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/layout/theme-toggle';

/**
 * Kerangka halaman login & register: kartu di tengah layar.
 * Dipakai bersama supaya tampilannya konsisten.
 */
export interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">Duitku</span>
            <span className="text-[11px] text-muted-foreground">Pencatat Keuangan Pribadi</span>
          </span>
        </div>
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-5 p-6">{children}</CardContent>
          </Card>

          <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>

          <div className="mt-6 flex items-start justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="max-w-xs text-center">
              Datamu terpisah dari pengguna lain. Setiap orang hanya bisa melihat catatannya sendiri.
            </p>
          </div>

          <div className="mt-5">
            <SupabaseSetupNotice />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Kotak pesan error/sukses di dalam form autentikasi. */
export function AuthMessage({ tone, children }: { tone: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const styles = {
    error: 'border-destructive/30 bg-destructive/10 text-foreground',
    success: 'border-success/30 bg-success/10 text-foreground',
    info: 'border-border bg-muted/50 text-muted-foreground',
  } as const;

  return (
    <div className={`rounded-md border px-3 py-2.5 text-sm ${styles[tone]}`} role="status">
      {children}
    </div>
  );
}
