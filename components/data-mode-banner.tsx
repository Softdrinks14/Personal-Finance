'use client';

import { HardDrive } from 'lucide-react';
import { useData } from '@/components/data-provider';

/**
 * Peringatan kecil yang muncul kalau aplikasi masih memakai LocalStorage
 * (Supabase belum dihubungkan). Tujuannya supaya user paham datanya
 * disimpan di browser dan tidak ikut pindah ke perangkat lain.
 */
export function DataModeBanner() {
  const { mode } = useData();
  if (mode === 'supabase') return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-foreground">
        <strong className="font-medium">Mode LocalStorage aktif.</strong> Datamu tersimpan di browser
        ini saja (aman untuk mencoba-coba). Agar tersimpan permanen & bisa dibuka dari HP, isi
        kredensial Supabase di file <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>{' '}
        lalu restart <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run dev</code>. Caranya
        ada di README.
      </p>
    </div>
  );
}
