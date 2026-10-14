'use client';

import * as React from 'react';
import { useToast } from '@/components/ui/toast';
import {
  DATA_MODE_LABEL,
  createTransaction,
  createTransactions,
  dataMode,
  deleteAllTransactions,
  deleteTransaction,
  listCategories,
  listTransactions,
  seedDemoTransactions,
  updateTransaction,
} from '@/lib/storage';
import type { Category, DataMode, Transaction, TransactionInput } from '@/lib/types';

/**
 * DataProvider = "gudang data" versi React.
 *
 * Analogi: daripada setiap halaman bolak-balik menelepon bank data
 * (yang bikin lambat), kita ambil sekali di sini lalu bagikan ke semua
 * komponen yang butuh. Setiap kali data berubah, semua ikut ter-update.
 */

interface DataContextValue {
  /** 'supabase' atau 'local' */
  mode: DataMode;
  modeLabel: string;
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<DataMode>('local');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMode(dataMode());
      const [cats, txs] = await Promise.all([listCategories(), listTransactions()]);
      setCategories(cats);
      setTransactions(txs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak dikenal.';
      setError(message);
      toast({ title: 'Gagal memuat data', description: message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTransaction = React.useCallback(
    async (input: TransactionInput) => {
      try {
        await createTransaction(input);
        await refresh();
        toast({ title: 'Transaksi tersimpan', tone: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menyimpan.';
        toast({ title: 'Gagal menyimpan transaksi', description: message, tone: 'error' });
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
        toast({ title: 'Gagal menyimpan hasil scan', description: message, tone: 'error' });
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
        toast({ title: 'Gagal memperbarui transaksi', description: message, tone: 'error' });
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
        toast({ title: 'Gagal menghapus transaksi', description: message, tone: 'error' });
        throw err;
      }
    },
    [refresh, toast],
  );

  const resetTransactions = React.useCallback(async () => {
    try {
      await deleteAllTransactions();
      await refresh();
      toast({ title: 'Semua transaksi dihapus', tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus data.';
      toast({ title: 'Gagal mereset data', description: message, tone: 'error' });
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
      toast({ title: 'Gagal membuat data contoh', description: message, tone: 'error' });
    }
  }, [refresh, toast]);

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const value = React.useMemo<DataContextValue>(
    () => ({
      mode,
      modeLabel: DATA_MODE_LABEL[mode],
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
      mode,
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
