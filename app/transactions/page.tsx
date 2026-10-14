'use client';

import * as React from 'react';
import { Download, Plus, Search, X } from 'lucide-react';
import { useData } from '@/components/data-provider';
import { AppShell } from '@/components/layout/app-shell';
import { TransactionForm } from '@/components/transaction-form';
import { TransactionTable } from '@/components/transaction-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { availableMonths } from '@/lib/analytics';
import { csvFilename, transactionsToCsv } from '@/lib/csv';
import type { Transaction, TransactionInput } from '@/lib/types';
import { downloadTextFile, formatIDR, monthLabel } from '@/lib/utils';

/**
 * HALAMAN RIWAYAT & LAPORAN  (route: "/transactions")
 *
 * Fitur: pencarian, filter kategori/bulan/jenis, edit, hapus, dan export CSV.
 */
export default function TransactionsPage() {
  const { transactions, categories, loading, addTransaction, editTransaction, removeTransaction } =
    useData();
  const { toast } = useToast();

  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [monthFilter, setMonthFilter] = React.useState('all');

  const [editing, setEditing] = React.useState<Transaction | null>(null);
  const [creating, setCreating] = React.useState(false);

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const months = React.useMemo(() => availableMonths(transactions), [transactions]);

  /** Terapkan semua filter sekaligus. */
  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      if (categoryFilter !== 'all') {
        const key = tx.category_id ?? '__none__';
        if (key !== categoryFilter) return false;
      }

      if (monthFilter !== 'all' && tx.date.slice(0, 7) !== monthFilter) return false;

      if (query) {
        const categoryName = tx.category_id ? categoryById.get(tx.category_id)?.name ?? '' : '';
        const sourceLabel = tx.source === 'ocr' ? 'scan ocr screenshot' : 'manual';
        const haystack =
          `${tx.note ?? ''} ${categoryName} ${sourceLabel} ${formatIDR(tx.amount)} ${tx.date}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [transactions, search, typeFilter, categoryFilter, monthFilter, categoryById]);

  const totals = React.useMemo(() => {
    const income = filtered.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filtered.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const isFiltering =
    search.trim() !== '' || typeFilter !== 'all' || categoryFilter !== 'all' || monthFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setMonthFilter('all');
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: 'Tidak ada data untuk diexport', tone: 'error' });
      return;
    }
    downloadTextFile(csvFilename(), transactionsToCsv(filtered, categories), 'text/csv;charset=utf-8');
    toast({
      title: 'File CSV dibuat',
      description: `${filtered.length} transaksi siap dibuka di Excel / Google Sheets.`,
      tone: 'success',
    });
  };

  const handleCreate = async (input: TransactionInput) => {
    await addTransaction(input);
    setCreating(false);
  };

  const handleUpdate = async (input: TransactionInput) => {
    if (!editing) return;
    await editTransaction(editing.id, input);
    setEditing(null);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Judul */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Riwayat & Laporan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Memuat data...'
                : `${filtered.length} dari ${transactions.length} transaksi ditampilkan.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Transaksi Baru
            </Button>
          </div>
        </div>

        {/* Ringkasan hasil filter */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Pemasukan (terfilter)', value: totals.income, className: 'text-success' },
            { label: 'Pengeluaran (terfilter)', value: totals.expense, className: 'text-destructive' },
            { label: 'Selisih', value: totals.net, className: 'text-foreground' },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className={`tabular mt-1 text-xl font-semibold ${item.className}`}>
                  {formatIDR(item.value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Cari & Filter</CardTitle>
            <CardDescription>Persempit daftar transaksi sesuai kebutuhan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="search">Pencarian</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Cari keterangan, kategori, atau nominal..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-type">Jenis</Label>
              <Select
                id="filter-type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              >
                <option value="all">Semua jenis</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-month">Bulan</Label>
              <Select
                id="filter-month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              >
                <option value="all">Semua bulan</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-3">
              <Label htmlFor="filter-category">Kategori</Label>
              <Select
                id="filter-category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">Semua kategori</option>
                <option value="__none__">Tanpa kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            {isFiltering ? (
              <div className="flex items-end">
                <Button variant="ghost" onClick={resetFilters} className="w-full">
                  <X className="h-4 w-4" /> Reset filter
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Tabel */}
        <Card>
          <CardContent className="px-0 py-0">
            <TransactionTable
              transactions={filtered}
              categories={categories}
              onEdit={(tx) => setEditing(tx)}
              onDelete={(id) => removeTransaction(id)}
              emptyMessage={
                isFiltering
                  ? 'Tidak ada transaksi yang cocok dengan filter. Coba reset filter.'
                  : 'Belum ada transaksi. Tekan "Transaksi Baru" untuk mulai mencatat.'
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Dialog: tambah transaksi baru */}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Tambah Transaksi"
        description="Isi nominal, tanggal, dan kategori transaksi."
      >
        <TransactionForm
          categories={categories}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Dialog>

      {/* Dialog: edit transaksi */}
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit Transaksi"
        description="Ubah data yang salah, lalu simpan."
      >
        {editing ? (
          <TransactionForm
            categories={categories}
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </AppShell>
  );
}
