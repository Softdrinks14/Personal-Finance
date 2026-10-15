import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { Category, Transaction, TransactionInput } from './types';
import { safeNumber } from './utils';

/* =========================================================================
 * LAPISAN DATA (DATA LAYER) — MULTI-USER
 * -------------------------------------------------------------------------
 * Semua halaman & komponen TIDAK memanggil Supabase langsung; mereka memakai
 * fungsi-fungsi di file ini.
 *
 * KEAMANAN — ada DUA lapis, dan keduanya penting:
 *
 *   1. Kode (file ini) SELALU mengirim `user_id` milik pengguna yang sedang
 *      login, dan SELALU menambahkan filter `.eq('user_id', ...)`.
 *   2. Database (Row Level Security di Supabase) menolak baris apa pun yang
 *      tidak cocok dengan `auth.uid()`.
 *
 * Lapisan 2-lah yang benar-benar mengamankan data: walaupun lapisan 1 punya
 * bug, pengguna tetap tidak bisa melihat atau mengubah data orang lain.
 * Lapisan 1 membuat kesalahan ketahuan lebih awal (error jelas, bukan data
 * kosong yang membingungkan).
 * ========================================================================= */

/** Daftar kategori bawaan. Sumber kebenaran ada di trigger `handle_new_user()`. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; type: Category['type']; color: string }> = [
  { name: 'Makanan & Minuman', type: 'expense', color: '#f97316' },
  { name: 'Transportasi', type: 'expense', color: '#0ea5e9' },
  { name: 'Tagihan & Utilitas', type: 'expense', color: '#8b5cf6' },
  { name: 'Belanja', type: 'expense', color: '#ec4899' },
  { name: 'Hiburan', type: 'expense', color: '#f43f5e' },
  { name: 'Kesehatan', type: 'expense', color: '#14b8a6' },
  { name: 'Pendidikan', type: 'expense', color: '#6366f1' },
  { name: 'Lain-lain', type: 'expense', color: '#64748b' },
  { name: 'Gaji', type: 'income', color: '#10b981' },
  { name: 'Bonus & THR', type: 'income', color: '#22c55e' },
  { name: 'Usaha / Freelance', type: 'income', color: '#84cc16' },
  { name: 'Investasi', type: 'both', color: '#eab308' },
];

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

function requireClient(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase belum dikonfigurasi. Aplikasi ini memerlukan Supabase untuk login dan menyimpan data.',
    );
  }
  return client;
}

/**
 * Ambil id pengguna yang sedang login.
 *
 * `auth.getUser()` memverifikasi token ke server Supabase, jadi id ini
 * benar-benar milik pengguna yang sah — bukan sekadar isi cookie yang bisa
 * dipalsukan dari sisi browser.
 */
export async function getCurrentUserId(client: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const userId = await getCurrentUserId(client);
  if (!userId) {
    throw new Error('Sesi login tidak ditemukan. Silakan masuk (login) kembali.');
  }
  return userId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RawTransaction extends Omit<Transaction, 'amount' | 'date'> {
  amount: number | string;
  date: string;
}

/** Supabase mengembalikan `numeric` sebagai string; kita jadikan angka. */
function normalizeTransaction(row: RawTransaction): Transaction {
  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    type: row.type,
    amount: safeNumber(row.amount),
    date: String(row.date).slice(0, 10),
    category_id: row.category_id ?? null,
    note: row.note ?? null,
    source: row.source ?? 'manual',
    created_at: row.created_at,
  };
}

/**
 * Pastikan category_id yang dipakai benar-benar milik pengguna ini.
 * Kalau id-nya bukan UUID (mis. data lama "cat-makanan"), kita carikan
 * kategori dengan nama yang sama miliknya sendiri.
 */
async function resolveCategoryId(
  client: SupabaseClient,
  categoryId: string | null,
  userId: string,
  cache: Category[],
): Promise<string | null> {
  if (!categoryId) return null;
  if (UUID_RE.test(categoryId)) return categoryId;

  const fallback = DEFAULT_CATEGORIES.find((c) => c.name === categoryId);
  if (!fallback) return null;

  const existing = cache.find((c) => c.name === fallback.name);
  if (existing) return existing.id;

  const { data, error } = await client
    .from('categories')
    .insert({ user_id: userId, name: fallback.name, type: fallback.type, color: fallback.color })
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
  const client = requireClient();
  const userId = await requireUserId(client);

  // RLS sudah menyaring, tapi filter eksplisit membuat maksudnya terbaca
  // dan tetap benar walau RLS sedang tidak aktif.
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) throw new Error(`Gagal memuat kategori: ${error.message}`);
  return (data ?? []) as Category[];
}

export async function createCategory(input: {
  name: string;
  type: Category['type'];
  color: string;
}): Promise<Category> {
  const client = requireClient();
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from('categories')
    .insert({ ...input, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(`Gagal menyimpan kategori: ${error.message}`);
  return data as Category;
}

/* ------------------------------------------------------------------ */
/* TRANSAKSI                                                           */
/* ------------------------------------------------------------------ */

export async function listTransactions(): Promise<Transaction[]> {
  const client = requireClient();
  const userId = await requireUserId(client);

  const { data, error } = await client
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat transaksi: ${error.message}`);
  return ((data ?? []) as RawTransaction[]).map(normalizeTransaction);
}

/** Simpan banyak transaksi sekaligus — dipakai setelah review hasil OCR. */
export async function createTransactions(inputs: TransactionInput[]): Promise<Transaction[]> {
  if (inputs.length === 0) return [];

  const client = requireClient();
  const userId = await requireUserId(client);

  const categories = await listCategories().catch(() => [] as Category[]);
  const cache: Category[] = [...categories];

  const payload: Array<Record<string, unknown>> = [];
  for (const input of inputs) {
    payload.push({
      // INI KUNCI ISOLASI DATA: setiap baris ditandai milik siapa.
      user_id: userId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      category_id: await resolveCategoryId(client, input.category_id, userId, cache),
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
  const client = requireClient();
  const userId = await requireUserId(client);

  const payload: Record<string, unknown> = { ...patch };
  if ('category_id' in patch) {
    const categories = await listCategories().catch(() => [] as Category[]);
    payload.category_id = await resolveCategoryId(
      client,
      patch.category_id ?? null,
      userId,
      [...categories],
    );
  }

  const { data, error } = await client
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId) // pengaman kedua: hanya baris milik sendiri
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui transaksi: ${error.message}`);
  return data ? normalizeTransaction(data as RawTransaction) : null;
}

export async function deleteTransaction(id: string): Promise<void> {
  const client = requireClient();
  const userId = await requireUserId(client);

  const { error } = await client.from('transactions').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Gagal menghapus transaksi: ${error.message}`);
}

/** Hapus semua transaksi MILIK SAYA (kategori & data pengguna lain aman). */
export async function deleteAllTransactions(): Promise<void> {
  const client = requireClient();
  const userId = await requireUserId(client);

  const { error } = await client.from('transactions').delete().eq('user_id', userId);
  if (error) throw new Error(`Gagal menghapus data: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* DATA CONTOH (DEMO)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Buat data contoh 6 bulan terakhir untuk pengguna yang sedang login,
 * supaya grafik dashboard langsung terisi.
 *
 * Kategori dicari berdasarkan NAMA, karena setiap pengguna punya id kategori
 * sendiri-sendiri (UUID berbeda).
 */
export async function seedDemoTransactions(): Promise<number> {
  const templates: Array<{ cat: string; note: string; min: number; max: number; freq: number }> = [
    { cat: 'Makanan & Minuman', note: 'Makan siang', min: 20_000, max: 60_000, freq: 12 },
    { cat: 'Makanan & Minuman', note: 'Belanja bulanan', min: 250_000, max: 600_000, freq: 2 },
    { cat: 'Transportasi', note: 'Bensin / ojek online', min: 25_000, max: 120_000, freq: 8 },
    { cat: 'Tagihan & Utilitas', note: 'Listrik & internet', min: 250_000, max: 550_000, freq: 1 },
    { cat: 'Tagihan & Utilitas', note: 'Pulsa & paket data', min: 50_000, max: 150_000, freq: 1 },
    { cat: 'Belanja', note: 'Belanja online', min: 80_000, max: 450_000, freq: 3 },
    { cat: 'Hiburan', note: 'Langganan streaming', min: 54_000, max: 186_000, freq: 1 },
    { cat: 'Kesehatan', note: 'Vitamin & obat', min: 45_000, max: 220_000, freq: 1 },
  ];

  const categories = await listCategories();
  const idByName = new Map(categories.map((c) => [c.name, c.id]));

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

    if (maxDay >= 25) {
      inputs.push({
        type: 'income',
        amount: 8_500_000,
        date: iso(25),
        category_id: idByName.get('Gaji') ?? null,
        note: 'Gaji bulanan',
        source: 'manual',
      });
    }
    if (monthOffset % 3 === 0 && maxDay >= 10) {
      inputs.push({
        type: 'income',
        amount: 1_500_000,
        date: iso(10),
        category_id: idByName.get('Usaha / Freelance') ?? null,
        note: 'Proyek freelance',
        source: 'manual',
      });
    }

    for (const template of templates) {
      for (let i = 0; i < template.freq; i += 1) {
        const day = 1 + Math.floor(Math.random() * maxDay);
        const amount = Math.round((template.min + Math.random() * (template.max - template.min)) / 500) * 500;
        inputs.push({
          type: 'expense',
          amount,
          date: iso(Math.min(day, maxDay)),
          category_id: idByName.get(template.cat) ?? null,
          note: template.note,
          source: 'manual',
        });
      }
    }
  }

  const created = await createTransactions(inputs);
  return created.length;
}
