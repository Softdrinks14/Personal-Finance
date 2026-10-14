'use client';

import { DataProvider } from '@/components/data-provider';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Kumpulan "provider" global yang membungkus seluruh aplikasi.
 *
 * Urutannya penting:
 *   ToastProvider  -> menyediakan fungsi notifikasi
 *   DataProvider   -> mengambil data transaksi & kategori sekali saja,
 *                     lalu dibagikan ke semua halaman (biar tidak bolak-balik fetch)
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DataProvider>{children}</DataProvider>
    </ToastProvider>
  );
}
