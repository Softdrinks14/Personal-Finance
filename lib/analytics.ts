import type { Category, Transaction, TxType } from './types';
import { lastNMonthKeys, monthKey, monthLabel } from './utils';

/* =========================================================================
 * LAPISAN ANALITIK
 * -------------------------------------------------------------------------
 * Semua perhitungan angka (total, grafik, persentase) dikumpulkan di sini
 * supaya komponen tampilan tetap bersih dan mudah dibaca.
 * ========================================================================= */

export interface MonthlyPoint {
  /** "2026-10" */
  key: string;
  /** "Okt 2026" */
  label: string;
  income: number;
  expense: number;
  net: number;
}

/**
 * Susun data grafik batang: pemasukan vs pengeluaran per bulan.
 * Bulan yang tidak punya transaksi tetap ditampilkan dengan nilai 0
 * supaya grafiknya tidak "bolong".
 */
export function buildMonthlySeries(transactions: Transaction[], months = 6): MonthlyPoint[] {
  const keys = lastNMonthKeys(months);
  const index = new Map<string, MonthlyPoint>(
    keys.map((key) => [key, { key, label: monthLabel(key), income: 0, expense: 0, net: 0 }]),
  );

  for (const tx of transactions) {
    const point = index.get(monthKey(tx.date));
    if (!point) continue;
    if (tx.type === 'income') point.income += tx.amount;
    else point.expense += tx.amount;
  }

  for (const point of index.values()) {
    point.net = point.income - point.expense;
  }

  return keys.map((key) => index.get(key)!);
}

export interface CategorySlice {
  id: string;
  name: string;
  color: string;
  value: number;
  /** persentase terhadap total, 0..100 */
  share: number;
}

/**
 * Hitung pembagian per kategori untuk diagram lingkaran.
 * Transaksi tanpa kategori dikelompokkan sebagai "Tanpa kategori".
 */
export function buildCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: TxType,
): CategorySlice[] {
  const colorById = new Map(categories.map((c) => [c.id, c.color]));
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();

  let grandTotal = 0;
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const key = tx.category_id ?? '__none__';
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    grandTotal += tx.amount;
  }

  return [...totals.entries()]
    .map(([id, value]) => ({
      id,
      name: id === '__none__' ? 'Tanpa kategori' : nameById.get(id) ?? 'Tanpa kategori',
      color: id === '__none__' ? '#94a3b8' : colorById.get(id) ?? '#94a3b8',
      value,
      share: grandTotal > 0 ? Math.round((value / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  /** jumlah transaksi di bulan ini */
  count: number;
  /** pemasukan bulan lalu (untuk membandingkan tren) */
  previousIncome: number;
  previousExpense: number;
  /** selisih persen pemasukan dibanding bulan lalu; null kalau tidak bisa dihitung */
  incomeChange: number | null;
  expenseChange: number | null;
  /** persentase tabungan dari pemasukan, 0..100 */
  savingRate: number;
}

function sumType(transactions: Transaction[], type: TxType): number {
  return transactions.filter((t) => t.type === type).reduce((acc, t) => acc + t.amount, 0);
}

/** Ubah "2026-10" menjadi "2026-09" (bulan sebelumnya). */
function previousMonthKey(key: string): string {
  const [yearText, monthText] = key.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Ringkasan angka untuk satu bulan tertentu (default: bulan yang sedang berjalan). */
export function summarizeMonth(transactions: Transaction[], key: string): MonthSummary {
  const current = transactions.filter((tx) => monthKey(tx.date) === key);
  const previous = transactions.filter((tx) => monthKey(tx.date) === previousMonthKey(key));

  const income = sumType(current, 'income');
  const expense = sumType(current, 'expense');
  const previousIncome = sumType(previous, 'income');
  const previousExpense = sumType(previous, 'expense');

  return {
    income,
    expense,
    net: income - expense,
    count: current.length,
    previousIncome,
    previousExpense,
    incomeChange: changePercent(income, previousIncome),
    expenseChange: changePercent(expense, previousExpense),
    savingRate: income > 0 ? Math.round(((income - expense) / income) * 1000) / 10 : 0,
  };
}

/** Ambil N transaksi terbaru. */
export function recentTransactions(transactions: Transaction[], limit = 5): Transaction[] {
  return [...transactions]
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
    })
    .slice(0, limit);
}

/** Daftar bulan yang punya data (untuk dropdown filter). */
export function availableMonths(transactions: Transaction[]): string[] {
  const keys = new Set(transactions.map((tx) => monthKey(tx.date)));
  return [...keys].sort((a, b) => (a < b ? 1 : -1));
}
