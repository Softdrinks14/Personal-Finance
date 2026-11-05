import type { Category, Transaction } from './types';
import { formatDateID } from './utils';

/* =========================================================================
 * EXPORT CSV
 * -------------------------------------------------------------------------
 * CSV = file teks sederhana yang bisa dibuka di Excel / Google Sheets.
 * Angka & teks dipisah dengan koma (atau titik koma, tergantung Excel lokal).
 * ========================================================================= */

/**
 * Deteksi transaksi "Saldo sisa bulan lalu" (didefinisikan lengkap di
 * analytics.ts). Sengaja tanpa `import` supaya lib ini tetap berdiri sendiri
 * dan tidak membentuk impor melingkar analytics <-> csv.
 */
function isCarryOverTransaction(tx: Transaction): boolean {
  if (tx.type !== 'income') return false;
  return (tx.note ?? '').trim().toLowerCase().startsWith('saldo sisa bulan lalu');
}

/** Bungkus satu nilai supaya aman kalau isinya mengandung koma atau kutip. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Ubah matriks data menjadi teks CSV. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * Susun CSV lengkap dari daftar transaksi.
 * Kolomnya sengaja dibuat mirip mutasi bank supaya mudah dibaca.
 */
export function transactionsToCsv(transactions: Transaction[], categories: Category[]): string {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const header = ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Nominal (Rp)', 'Sumber'];
  const rows: Array<Array<string | number | null>> = [header];

  for (const tx of transactions) {
    const isCarryOver = isCarryOverTransaction(tx);
    rows.push([
      formatDateID(tx.date),
      isCarryOver ? 'Pemasukan (saldo bulan lalu)' : tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      tx.category_id ? categoryName.get(tx.category_id) ?? 'Tanpa kategori' : 'Tanpa kategori',
      tx.note ?? '',
      tx.type === 'income' ? tx.amount : -tx.amount,
      tx.source === 'ocr' ? 'Scan OCR' : 'Manual',
    ]);
  }

  /*
   * Total di baris bawah dibuat SAMA dengan kartu di halaman Riwayat & Laporan:
   * transaksi "Saldo sisa bulan lalu" dipisah dan tidak ikut Total Pemasukan,
   * supaya angka di file tidak bertentangan dengan angka di layar.
   */
  const counted = transactions.filter((t) => !isCarryOverTransaction(t));
  const totalIncome = counted
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = counted
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalCarryOver = transactions
    .filter(isCarryOverTransaction)
    .reduce((acc, t) => acc + t.amount, 0);

  rows.push([]);
  rows.push(['', '', '', 'Total Pemasukan', totalIncome, '']);
  if (totalCarryOver > 0) {
    rows.push(['', '', '', 'Saldo sisa bulan lalu (tidak dihitung)', totalCarryOver, '']);
  }
  rows.push(['', '', '', 'Total Pengeluaran', totalExpense, '']);
  rows.push(['', '', '', 'Saldo Bersih', totalIncome - totalExpense, '']);

  // BOM (\uFEFF) penting supaya Excel membaca huruf beraksen & "Rp" dengan benar.
  return `\uFEFF${toCsv(rows)}`;
}

/** Nama file export yang rapi, contoh: `transaksi-2026-10-14.csv`. */
export function csvFilename(prefix = 'transaksi'): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
