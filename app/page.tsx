'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { CategoryDonutChart } from '@/components/charts/category-donut-chart';
import { MonthlyBarChart } from '@/components/charts/monthly-bar-chart';
import { useData } from '@/components/data-provider';
import { SupabaseSetupNotice } from '@/components/supabase-setup-notice';
import { AppShell } from '@/components/layout/app-shell';
import { SummaryCards } from '@/components/summary-cards';
import { TransactionForm } from '@/components/transaction-form';
import { TransactionTable } from '@/components/transaction-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildCategoryBreakdown, buildMonthlySeries, recentTransactions, summarizeMonth } from '@/lib/analytics';
import type { TxType } from '@/lib/types';
import { MONTHS_ID_LONG, cn, lastNMonthKeys, monthKeyFromDate, monthLabel } from '@/lib/utils';

/**
 * HALAMAN DASHBOARD  (route: "/")
 *
 * Isinya:
 *  1. Kartu ringkasan bulan ini (pemasukan, pengeluaran, saldo bersih)
 *  2. Grafik batang 6 bulan terakhir
 *  3. Diagram donat pengeluaran per kategori
 *  4. Tabel 5 transaksi terakhir
 *  5. Form cepat untuk menambah transaksi
 */
export default function DashboardPage() {
  const {
    transactions,
    categories,
    loading,
    addTransaction,
    removeTransaction,
    loadDemoData,
    resetTransactions,
  } = useData();

  // Bulan yang sedang dilihat (default: bulan ini).
  // PENTING: pakai monthKeyFromDate (waktu LOKAL), bukan toISOString() yang
  // memakai UTC. Di WIB (UTC+7), tanggal 1 pukul 00:00–07:00 masih "bulan lalu"
  // menurut UTC, sehingga default-nya bisa meleset satu bulan.
  const [period, setPeriod] = React.useState<string>(() => monthKeyFromDate(new Date()));
  const [breakdownType, setBreakdownType] = React.useState<TxType>('expense');

  const summary = React.useMemo(() => summarizeMonth(transactions, period), [transactions, period]);
  const monthlySeries = React.useMemo(() => buildMonthlySeries(transactions, 6), [transactions]);
  const periodTransactions = React.useMemo(
    () => transactions.filter((tx) => tx.date.slice(0, 7) === period),
    [transactions, period],
  );
  const breakdown = React.useMemo(
    () => buildCategoryBreakdown(periodTransactions, categories, breakdownType),
    [periodTransactions, categories, breakdownType],
  );
  const recent = React.useMemo(() => recentTransactions(transactions, 5), [transactions]);

  /*
   * Daftar bulan pada dropdown "Pilih bulan".
   *
   * Isinya = 6 bulan terakhir (dihitung dari tanggal hari ini) DITAMBAH bulan
   * apa pun yang punya transaksi. Jadi:
   *   - Bulan baru otomatis muncul begitu kalender berganti bulan (tanpa diisi manual).
   *   - Data lama (lebih dari 6 bulan lalu) tetap bisa dibuka, tidak "hilang" dari pilihan.
   * Urutan: terbaru di atas.
   */
  const periodOptions = React.useMemo(() => {
    const keys = new Set<string>(lastNMonthKeys(6));
    for (const tx of transactions) keys.add(tx.date.slice(0, 7));
    return [...keys].sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  const periodLabel = `${MONTHS_ID_LONG[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
  const hasAnyData = transactions.length > 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Judul halaman */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard Keuangan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ringkasan uang masuk dan keluar untuk periode {periodLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="period">
              Pilih bulan
            </label>
            <select
              id="period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {periodOptions.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>

            <Button variant="outline" onClick={() => void loadDemoData()}>
              <Sparkles className="h-4 w-4" /> Isi data contoh
            </Button>

            <Link href="/transactions">
              <Button>
                Semua Transaksi <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <SupabaseSetupNotice />

        {/* 1. Kartu ringkasan */}
        <SummaryCards summary={summary} periodLabel={periodLabel} />

        {/* 2 & 3. Grafik */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pemasukan vs Pengeluaran</CardTitle>
              <CardDescription>Perbandingan 6 bulan terakhir.</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyBarChart data={monthlySeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Per Kategori</CardTitle>
                <CardDescription>Pembagian {breakdownType === 'expense' ? 'pengeluaran' : 'pemasukan'}.</CardDescription>
              </div>
              <div className="flex rounded-md border border-border p-0.5">
                {(['expense', 'income'] as TxType[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBreakdownType(option)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      breakdownType === option
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {option === 'expense' ? 'Keluar' : 'Masuk'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <CategoryDonutChart data={breakdown} />
            </CardContent>
          </Card>
        </div>

        {/* 4 & 5. Tabel terakhir + form cepat */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Transaksi Terakhir</CardTitle>
                <CardDescription>5 catatan paling baru.</CardDescription>
              </div>
              <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {loading ? (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">Memuat data...</p>
              ) : (
                <TransactionTable
                  transactions={recent}
                  categories={categories}
                  onDelete={(id) => removeTransaction(id)}
                  emptyMessage="Belum ada transaksi. Tambahkan lewat form di samping atau tekan 'Isi data contoh'."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Tambah Cepat
              </CardTitle>
              <CardDescription>Catat uang masuk / keluar dalam hitungan detik.</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionForm categories={categories} onSubmit={addTransaction} />
            </CardContent>
          </Card>
        </div>

        {/* Aksi tambahan */}
        {hasAnyData ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              Total {transactions.length} transaksi tercatat.
            </div>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (window.confirm('Hapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan.')) {
                  void resetTransactions();
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Reset semua data
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
