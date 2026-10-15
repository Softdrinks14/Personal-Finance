'use client';

import * as React from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/ui/toast';
import {
  createTransaction,
  createTransactions,
  deleteAllTransactions,
  deleteTransaction,
  listCategories,
  listTransactions,
  seedDemoTransactions,
  updateTransaction,
} from '@/lib/storage';
import type { Category, Transaction, TransactionInput } from '@/lib/types';

/* =========================================================================
 * DATA PROVIDER
 * -------------------------------------------------------------------------
 * "Gudang data" versi React: mengambil data sekali, lalu membagikannya ke
 * semua halaman.
 *
 * ⚠️ URUTAN ITU PENTING — inilah sumber error "Gagal memuat data":
 *
 *   DataProvider hidup di layout root, jadi ia TERPASANG JUGA saat pengguna
 *   masih berada di halaman /login (belum punya sesi). Kalau ia langsung
 *   mengambil data, permintaannya ditolak ("Sesi login tidak ditemukan") dan
 *   muncul toast "Gagal memuat data" yang membingungkan.
 *
 *   Karena itu komponen ini:
 *     1. MENUNGGU sampai status login diketahui (`loading` dari AuthProvider),
 *     2. hanya memuat kalau ada pengguna yang login,
 *     3. memuat ULANG otomatis begitu pengguna berubah (login / ganti akun /
 *        logout) — sebelumnya data tidak pernah dimuat ulang setelah login.
 *
 * Semua fungsi di lib/storage.ts sudah otomatis hanya mengambil data MILIK
 * pengguna yang sedang login.
 * ========================================================================= */

interface DataContextValue {
  loading: boolean;
  error: string | null;
  transactions: Transaction[];
  categories: Category[];
  /** pencarian kategori cepat berdasarkan id */
  categoryById: Map<string, Category>;
  refresh: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  addTransactions: (inputs: TransactionInput[]) => Promise<number>;
  editTransaction: (id: string, patch: Partial<TransactionInput>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  resetTransactions: () => Promise<void>;
  loadDemoData: () => Promise<void>;
}

const DataContext = React.createContext<DataContextValue | null>(null);

/**
 * Ubah error teknis database menjadi kalimat yang bisa ditindaklanjuti.
 * Khususnya: kalau migrasi multi-user belum dijalankan, pesannya jadi jelas.
 */
function explainError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('user_id') && (text.includes('does not exist') || text.includes('column'))) {
    return `${message} — Jalankan "supabase/schema.sql" (atau migrasi 002) di SQL Editor Supabase agar kolom user_id ada.`;
  }
  if (text.includes('permission denied') || text.includes('row-level security')) {
    return `${message} — Kebijakan RLS belum lengkap. Jalankan seluruh isi "supabase/schema.sql" di SQL Editor Supabase.`;
  }
  if (text.includes('sesi login tidak ditemukan')) {
    return `${message} Coba muat ulang halaman (F5).`;
  }

  return message;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    // Belum login -> tidak ada yang perlu dimuat, dan JANGAN tampilkan error.
    if (!user) {
      setTransactions([]);
      setCategories([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [cats, txs] = await Promise.all([listCategories(), listTransactions()]);
      setCategories(cats);
      setTransactions(txs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak dikenal.';
      setError(message);
      toast({ title: 'Gagal memuat data', description: explainError(message), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    // Tunggu sampai AuthProvider tahu siapa yang login.
    if (authLoading) return;
    void refresh();
    // refresh berubah ketika `user` berubah, sehingga data otomatis dimuat
    // ulang setelah login dan dibersihkan setelah logout.
  }, [authLoading, refresh]);

  const addTransaction = React.useCallback(
    async (input: TransactionInput) => {
      try {
        await createTransaction(input);
        await refresh();
        toast({ title: 'Transaksi tersimpan', tone: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menyimpan.';
        toast({ title: 'Gagal menyimpan transaksi', description: explainError(message), tone: 'error' });
        throw err;
      }
    },
    [refresh, toast],
  );

  const addTransactions = React.useCallback(
    async (inputs: TransactionInput[]) => {
      if (inputs.length === 0) return 0;
      try {
        const created = await createTransactions(inputs);
        await refresh();
        toast({
          title: `${created.length} transaksi tersimpan`,
          description: 'Data dari hasil scan OCR sudah masuk ke catatanmu.',
          tone: 'success',
        });
        return created.length;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menyimpan.';
        toast({ title: 'Gagal menyimpan hasil scan', description: explainError(message), tone: 'error' });
        throw err;
      }
    },
    [refresh, toast],
  );

  const editTransaction = React.useCallback(
    async (id: string, patch: Partial<TransactionInput>) => {
      try {
        await updateTransaction(id, patch);
        await refresh();
        toast({ title: 'Perubahan disimpan', tone: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memperbarui.';
        toast({ title: 'Gagal memperbarui transaksi', description: explainError(message), tone: 'error' });
        throw err;
      }
    },
    [refresh, toast],
  );

  const removeTransaction = React.useCallback(
    async (id: string) => {
      try {
        await deleteTransaction(id);
        await refresh();
        toast({ title: 'Transaksi dihapus', tone: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menghapus.';
        toast({ title: 'Gagal menghapus transaksi', description: explainError(message), tone: 'error' });
        throw err;
      }
    },
    [refresh, toast],
  );

  const resetTransactions = React.useCallback(async () => {
    try {
      await deleteAllTransactions();
      await refresh();
      toast({ title: 'Semua transaksimu dihapus', tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus data.';
      toast({ title: 'Gagal mereset data', description: explainError(message), tone: 'error' });
    }
  }, [refresh, toast]);

  const loadDemoData = React.useCallback(async () => {
    try {
      const total = await seedDemoTransactions();
      await refresh();
      toast({
        title: `${total} transaksi contoh dibuat`,
        description: 'Grafik dashboard sekarang terisi. Hapus kapan saja lewat tombol Reset.',
        tone: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat data contoh.';
      toast({ title: 'Gagal membuat data contoh', description: explainError(message), tone: 'error' });
    }
  }, [refresh, toast]);

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const value = React.useMemo<DataContextValue>(
    () => ({
      loading,
      error,
      transactions,
      categories,
      categoryById,
      refresh,
      addTransaction,
      addTransactions,
      editTransaction,
      removeTransaction,
      resetTransactions,
      loadDemoData,
    }),
    [
      loading,
      error,
      transactions,
      categories,
      categoryById,
      refresh,
      addTransaction,
      addTransactions,
      editTransaction,
      removeTransaction,
      resetTransactions,
      loadDemoData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = React.useContext(DataContext);
  if (!context) {
    throw new Error('useData() harus dipakai di dalam <DataProvider>.');
  }
  return context;
}
