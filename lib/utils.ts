import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/* =========================================================================
 * 1. UTILITAS UMUM
 * ========================================================================= */

/** Gabungkan className Tailwind dengan aman (menggabungkan class yang bentrok). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Buat id unik. Dipakai saat aplikasi berjalan di mode LocalStorage. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Ubah nilai apa pun (termasuk string dari Supabase) menjadi angka yang aman. */
export function safeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

export function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

/** Kelompokkan array berdasarkan hasil kunci dari callback. */
export function groupBy<T>(items: T[], keyOf: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyOf(item);
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}

/* =========================================================================
 * 2. FORMAT RUPIAH
 * ========================================================================= */

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const idrCompactFormatter = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const plainNumberFormatter = new Intl.NumberFormat('id-ID');

/** 1500000 -> "Rp 1.500.000" */
export function formatIDR(value: number): string {
  // Intl memakai non-breaking space; kita ganti jadi spasi biasa agar rapi di UI.
  return idrFormatter.format(safeNumber(value)).replace(/\u00A0/g, ' ');
}

/** Versi pendek untuk label grafik: 1500000 -> "Rp 1,5 jt" */
export function formatIDRCompact(value: number): string {
  const n = safeNumber(value);
  if (Math.abs(n) < 1_000_000) return formatIDR(n);
  return `Rp ${idrCompactFormatter.format(n)}`.replace(/\u00A0/g, ' ');
}

/** 1500000 -> "1.500.000" (tanpa "Rp", untuk input form) */
export function formatNumber(value: number): string {
  return plainNumberFormatter.format(safeNumber(value));
}

/** Buang semua karakter selain angka: "Rp 150.000" -> "150000" */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Format otomatis saat user mengetik nominal.
 * "1500000" -> "1.500.000"  (titik ribuan ditambahkan sendiri)
 */
export function formatThousands(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return '';
  return plainNumberFormatter.format(Number(digits));
}

/** Ambil angka murni dari input form: "1.500.000" -> 1500000 */
export function parseAmountInput(value: string): number {
  return Number(digitsOnly(value) || '0');
}

/* =========================================================================
 * 3. TANGGAL (tanpa library tambahan, agar bundle tetap ringan)
 * ========================================================================= */

export const MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const;

export const MONTHS_ID_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

/** Tanggal hari ini di zona waktu lokal, format ISO `yyyy-MM-dd`. */
export function todayISO(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * Ubah "yyyy-MM-dd" menjadi objek Date lokal.
 * Sengaja manual (bukan new Date("2026-10-14")) supaya tidak kena pergeseran
 * zona waktu yang membuat tanggal jadi mundur 1 hari.
 */
export function parseISODate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(iso);
}

/** "2026-10-14" -> "14 Okt 2026" */
export function formatDateID(iso: string): string {
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-10-14" -> "14 Oktober 2026" */
export function formatDateIDLong(iso: string): string {
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_ID_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-10-14" -> "2026-10" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Date -> "2026-10" */
export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-10" -> "Okt 2026" */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const index = Number(month) - 1;
  return `${MONTHS_ID[index] ?? month} ${year}`;
}

/** Daftar kunci bulan terakhir, urut dari paling lama ke paling baru. */
export function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(monthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

/* =========================================================================
 * 4. UNDUH FILE DI BROWSER
 * ========================================================================= */

/** Trigger unduhan file teks (dipakai untuk export CSV). */
export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
