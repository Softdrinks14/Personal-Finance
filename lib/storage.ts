import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { Category, DataMode, Transaction, TransactionInput } from './types';
import { monthKeyFromDate, safeNumber, uid } from './utils';

/* =========================================================================
 * LAPISAN DATA (DATA LAYER)
 * -------------------------------------------------------------------------
 * Semua halaman & komponen TIDAK boleh memanggil Supabase langsung.
 * Mereka memanggil fungsi-fungsi di file ini. Dengan begitu:
 *   - Kalau Supabase sudah diisi  -> data masuk ke PostgreSQL (online, multi-device)
 *   - Kalau Supabase belum diisi  -> data masuk ke localStorage (offline, 1 browser)
 * Logika aplikasi di atasnya tidak perlu tahu bedanya.
 * ========================================================================= */

const TX_KEY = 'pft.transactions.v1';
const CAT_KEY = 'pft.categories.v1';

/** Kategori bawaan. Id-nya dipakai apa adanya di mode LocalStorage. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-makanan', name: 'Makanan & Minuman', type: 'expense', color: '#f97316' },
  { id: 'cat-transportasi', name: 'Transportasi', type: 'expense', color: '#0ea5e9' },
  { id: 'cat-tagihan', name: 'Tagihan & Utilitas', type: 'expense', color: '#8b5cf6' },
  { id: 'cat-belanja', name: 'Belanja', type: 'expense', color: '#ec4899' },
  { id: 'cat-hiburan', name: 'Hiburan', type: 'expense', color: '#f43f5e' },
  { id: 'cat-kesehatan', name: 'Kesehatan', type: 'expense', color: '#14b8a6' },
  { id: 'cat-pendidikan', name: 'Pendidikan', type: 'expense', color: '#6366f1' },
  { id: 'cat-lainnya', name: 'Lain-lain', type: 'expense', color: '#64748b' },
  { id: 'cat-gaji', name: 'Gaji', type: 'income', color: '#10b981' },
  { id: 'cat-bonus', name: 'Bonus & THR', type: 'income', color: '#22c55e' },
  { id: 'cat-usaha', name: 'Usaha / Freelance', type: 'income', color: '#84cc16' },
  { id: 'cat-investasi', name: 'Investasi', type: 'both', color: '#eab308' },
];

/** Mode penyimpanan yang sedang aktif saat ini. */
export function dataMode(): DataMode {
  return isSupabaseConfigured ? 'supabase' : 'local';
}

export const DATA_MODE_LABEL: Record<DataMode, string> = {
  supabase: 'Supabase (Cloud)',
  local: 'LocalStorage (Browser)',
};

/* ------------------------------------------------------------------ */
/* Helper LocalStorage                                                 */
/* ------------------------------------------------------------------ */

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage bisa penuh / diblokir (mode private). Diamkan saja.
  }
}

/* ------------------------------------------------------------------ */
/* Helper Supabase                                                     */
/* ------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RawTransaction extends Omit<Transaction, 'amount' | 'date'> {
  amount: number | string;
  date: string;
}

/** Supabase mengembalikan `numeric` sebagai string; kita jadikan angka. */
function normalizeTransaction(row: RawTransaction): Transaction {
  return {
    id: String(row.id),
    type: row.type,
    amount: safeNumber(row.amount),
    date: String(row.date).slice(0, 10),
    category_id: row.category_id ?? null,
    note: row.note ?? null,
    source: row.source ?? 'manual',
    created_at: row.created_at,
  };
}

function sortTransactions(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
}

/**
 * Pastikan category_id yang dipakai benar-benar ada di tabel `categories`.
 * Kasus yang ditangani: user memakai mode LocalStorage (id kategori seperti
 * "cat-makanan"), lalu pindah ke Supabase (id kategori berupa UUID).
 * Kita cari berdasarkan nama, dan buat kalau belum ada.
 */
async function ensureCategoryId(
  client: SupabaseClient,
  categoryId: string | null,
  cache: Category[],
): Promise<string | null> {
  if (!categoryId) return null;
  if (UUID_RE.test(categoryId)) return categoryId;

  const local = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
  if (!local) return null;

  const existing = cache.find((c) => c.name === local.name);
  if (existing) return existing.id;

  const { data, error } = await client
    .from('categories')
    .insert({ name: local.name, type: local.type, color: local.color })
    .select()
    .single();

  if (error || !data) return null;
  cache.push(data as Category);
  return (data as Category).id;
}

/* ------------------------------------------------------------------ */
/* KATEGORI                                                            */
/* ------------------------------------------------------------------ */

export async function listCategories(): Promise<Category[]> {
  const client = getSupabase();

  if (!client) {
    const stored = readLocal<Category[]>(CAT_KEY, []);
    if (stored.length > 0) return stored;
    writeLocal(CAT_KEY, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }

  const { data, error } = await client.from('categories').select('*').order('name');
  if (error) throw new Error(`Gagal memuat kategori: ${error.message}`);

  const rows = (data ?? []) as Category[];
  if (rows.length > 0) return rows;

  // Tabel masih kosong -> isi kategori bawaan agar aplikasi langsung siap pakai.
  const { data: seeded, error: seedError } = await client
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map(({ name, type, color }) => ({ name, type, color })))
    .select();

  if (seedError || !seeded) {
    // Kalau gagal (misal kebijakan RLS), tetap kembalikan daftar lokal
    // supaya UI tidak kosong.
    return DEFAULT_CATEGORIES;
  }

  return seeded as Category[];
}

export async function createCategory(input: {
  name: string;
  type: Category['type'];
  color: string;
}): Promise<Category> {
  const client = getSupabase();

  if (!client) {
    const stored = readLocal<Category[]>(CAT_KEY, DEFAULT_CATEGORIES);
    const created: Category = { id: uid(), ...input };
    writeLocal(CAT_KEY, [...stored, created]);
    return created;
  }

  const { data, error } = await client.from('categories').insert(input).select().single();
  if (error) throw new Error(`Gagal menyimpan kategori: ${error.message}`);
  return data as Category;
}

/* ------------------------------------------------------------------ */
/* TRANSAKSI                                                           */
/* ------------------------------------------------------------------ */

export async function listTransactions(): Promise<Transaction[]> {
  const client = getSupabase();

  if (!client) {
    return sortTransactions(readLocal<Transaction[]>(TX_KEY, []));
  }

  const { data, error } = await client
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat transaksi: ${error.message}`);
  return ((data ?? []) as RawTransaction[]).map(normalizeTransaction);
}

/** Simpan banyak transaksi sekaligus — dipakai setelah review hasil OCR. */
export async function createTransactions(inputs: TransactionInput[]): Promise<Transaction[]> {
  if (inputs.length === 0) return [];

  const client = getSupabase();

  if (!client) {
    const existing = readLocal<Transaction[]>(TX_KEY, []);
    const now = new Date().toISOString();
    const created: Transaction[] = inputs.map((input) => ({
      ...input,
      id: uid(),
      created_at: now,
    }));
    writeLocal(TX_KEY, [...existing, ...created]);
    return created;
  }

  const categories = await listCategories().catch(() => [] as Category[]);
  const cache: Category[] = [...categories];

  const payload: Array<Record<string, unknown>> = [];
  for (const input of inputs) {
    payload.push({
      type: input.type,
      amount: input.amount,
      date: input.date,
      category_id: await ensureCategoryId(client, input.category_id, cache),
      note: input.note ?? null,
      source: input.source,
    });
  }

  const { data, error } = await client.from('transactions').insert(payload).select();
  if (error) throw new Error(`Gagal menyimpan transaksi: ${error.message}`);
  return ((data ?? []) as RawTransaction[]).map(normalizeTransaction);
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const [created] = await createTransactions([input]);
  return created;
}

export async function updateTransaction(
  id: string,
  patch: Partial<TransactionInput>,
): Promise<Transaction | null> {
  const client = getSupabase();

  if (!client) {
    const existing = readLocal<Transaction[]>(TX_KEY, []);
    let updated: Transaction | null = null;
    const next = existing.map((tx) => {
      if (tx.id !== id) return tx;
      updated = { ...tx, ...patch };
      return updated;
    });
    writeLocal(TX_KEY, next);
    return updated;
  }

  const categories = await listCategories().catch(() => [] as Category[]);
  const payload: Record<string, unknown> = { ...patch };
  if ('category_id' in patch) {
    payload.category_id = await ensureCategoryId(client, patch.category_id ?? null, [...categories]);
  }

  const { data, error } = await client
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui transaksi: ${error.message}`);
  return data ? normalizeTransaction(data as RawTransaction) : null;
}

export async function deleteTransaction(id: string): Promise<void> {
  const client = getSupabase();

  if (!client) {
    const existing = readLocal<Transaction[]>(TX_KEY, []);
    writeLocal(TX_KEY, existing.filter((tx) => tx.id !== id));
    return;
  }

  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus transaksi: ${error.message}`);
}

/** Hapus semua transaksi (kategori dibiarkan). Dipakai tombol "Reset data". */
export async function deleteAllTransactions(): Promise<void> {
  const client = getSupabase();

  if (!client) {
    writeLocal(TX_KEY, []);
    return;
  }

  const { error } = await client
    .from('transactions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Gagal menghapus data: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* DATA CONTOH (DEMO)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Buat data contoh 6 bulan terakhir supaya grafik dashboard langsung terisi.
 * Berguna untuk belajar / demo ke orang lain.
 */
export async function seedDemoTransactions(): Promise<number> {
  const expenseTemplates: Array<{ cat: string; note: string; min: number; max: number; freq: number }> = [
    { cat: 'cat-makanan', note: 'Makan siang', min: 20_000, max: 60_000, freq: 12 },
    { cat: 'cat-makanan', note: 'Belanja bulanan', min: 250_000, max: 600_000, freq: 2 },
    { cat: 'cat-transportasi', note: 'Bensin / ojek online', min: 25_000, max: 120_000, freq: 8 },
    { cat: 'cat-tagihan', note: 'Listrik & internet', min: 250_000, max: 550_000, freq: 1 },
    { cat: 'cat-tagihan', note: 'Pulsa & paket data', min: 50_000, max: 150_000, freq: 1 },
    { cat: 'cat-belanja', note: 'Belanja online', min: 80_000, max: 450_000, freq: 3 },
    { cat: 'cat-hiburan', note: 'Langganan streaming', min: 54_000, max: 186_000, freq: 1 },
    { cat: 'cat-kesehatan', note: 'Vitamin & obat', min: 45_000, max: 220_000, freq: 1 },
  ];

  const now = new Date();
  const inputs: TransactionInput[] = [];

  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const maxDay = monthOffset === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

    const iso = (day: number) =>
      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Pemasukan: gaji tanggal 25, bonus tiap 3 bulan
    if (maxDay >= 25) {
      inputs.push({
        type: 'income',
        amount: 8_500_000,
        date: iso(25),
        category_id: 'cat-gaji',
        note: 'Gaji bulanan',
        source: 'manual',
      });
    }
    if (monthOffset % 3 === 0 && maxDay >= 10) {
      inputs.push({
        type: 'income',
        amount: 1_500_000,
        date: iso(10),
        category_id: 'cat-usaha',
        note: 'Proyek freelance',
        source: 'manual',
      });
    }

    // Pengeluaran acak
    for (const template of expenseTemplates) {
      for (let i = 0; i < template.freq; i += 1) {
        const day = 1 + Math.floor(Math.random() * maxDay);
        const amount = Math.round((template.min + Math.random() * (template.max - template.min)) / 500) * 500;
        inputs.push({
          type: 'expense',
          amount,
          date: iso(Math.min(day, maxDay)),
          category_id: template.cat,
          note: template.note,
          source: 'manual',
        });
      }
    }
  }

  const created = await createTransactions(inputs);
  return created.length;
}

/** Ringkasan bulan berjalan — dipakai di kartu dashboard. */
export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}
