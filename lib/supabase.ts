import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Koneksi Supabase.
 *
 * Analogi: file ini seperti "nomor telepon + kunci gudang" ke database Supabase.
 * Kalau dua-duanya belum diisi di `.env.local`, aplikasi otomatis berpindah
 * ke mode LocalStorage (gudang kecil di dalam browser) supaya tetap bisa dipakai.
 */

/**
 * Rapikan URL Supabase sebelum dipakai.
 *
 * Kesalahan yang paling sering terjadi: menyalin "REST URL" dari dashboard
 * Supabase (https://xxxx.supabase.co/rest/v1/) padahal yang dibutuhkan hanya
 * alamat project-nya (https://xxxx.supabase.co).
 *
 * Kalau tidak dibersihkan, supabase-js akan memanggil
 *   https://xxxx.supabase.co/rest/v1/rest/v1/transactions
 * dan Supabase membalas error PostgREST PGRST125:
 *   "Invalid path specified in request URL"
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '') // buang garis miring di ujung
    .replace(/\/rest\/v1$/i, '') // buang path REST API yang tidak seharusnya ada
    .replace(/\/+$/, '');
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Bernilai true kalau URL & anon key sudah diisi dengan format yang masuk akal.
 * Kita cek panjang key (> 20 karakter) supaya placeholder seperti "xxx" tidak
 * dianggap valid dan bikin error aneh di runtime.
 */
export const isSupabaseConfigured: boolean =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.trim().length > 20;

let cachedClient: SupabaseClient | null = null;

/**
 * Ambil instance Supabase client.
 * Mengembalikan `null` kalau environment belum diisi (mode LocalStorage).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Aplikasi ini belum memakai login, jadi kita tidak perlu menyimpan sesi.
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { 'x-application-name': 'personal-finance-tracker' },
      },
    });
  }

  return cachedClient;
}

/** Sama seperti getSupabase(), tapi melempar error kalau belum dikonfigurasi. */
export function requireSupabase(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di file .env.local',
    );
  }
  return client;
}

/** Pesan bantuan yang ditampilkan di UI saat Supabase belum siap. */
export const SUPABASE_SETUP_HINT =
  'Belum terhubung ke Supabase. Buat file .env.local, isi NEXT_PUBLIC_SUPABASE_URL dan ' +
  'NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu restart `npm run dev`.';
