'use client';

import { AuthProvider } from '@/components/auth-provider';
import { DataProvider } from '@/components/data-provider';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Kumpulan "provider" global yang membungkus seluruh aplikasi.
 *
 * Urutannya penting:
 *   ToastProvider -> menyediakan fungsi notifikasi
 *   AuthProvider  -> mengetahui siapa yang sedang login (dari cookie sesi)
 *   DataProvider  -> mengambil transaksi & kategori MILIK pengguna tersebut
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>{children}</DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
