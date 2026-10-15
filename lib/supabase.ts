import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Koneksi Supabase untuk SISI BROWSER.
 *
 * Analogi: file ini seperti "nomor telepon + kunci gudang" ke database Supabase.
 *
 * PENTING — kenapa memakai `createBrowserClient` dari @supabase/ssr, bukan
 * `createClient` biasa:
 *
 *   Sesi login disimpan di COOKIE, bukan di localStorage. Cookie ikut terkirim
 *   ke server pada setiap request, sehingga:
 *     - middleware.ts bisa memeriksa "sudah login atau belum" SEBELUM halaman
 *       sempat dirender (itulah yang membuat proteksi rute benar-benar aman);
 *     - server bisa membaca identitas pengguna dan meneruskannya ke PostgreSQL,
 *       sehingga Row Level Security (auth.uid() = user_id) bekerja.
 *
 *   Kalau sesi disimpan di localStorage, server tidak melihatnya sama sekali
 *   dan proteksi rute hanya jadi hiasan.
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

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/**
 * Bernilai true kalau URL & anon key sudah diisi dengan format yang masuk akal.
 * Kita cek panjang key (> 20 karakter) supaya placeholder seperti "xxx" tidak
 * dianggap valid dan bikin error aneh di runtime.
 */
export const isSupabaseConfigured: boolean =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.trim().length > 20;

let cachedClient: SupabaseClient | null = null;

/**
 * Ambil instance Supabase client (browser).
 * Mengembalikan `null` kalau environment belum diisi, atau kalau dipanggil
 * dari sisi server (di server pakai lib/supabase/server.ts).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (typeof window === 'undefined') return null;

  if (!cachedClient) {
    cachedClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    throw new Error(SUPABASE_SETUP_HINT);
  }
  return client;
}

/** Pesan bantuan yang ditampilkan di UI saat Supabase belum siap. */
export const SUPABASE_SETUP_HINT =
  'Belum terhubung ke Supabase. Buat file .env.local, isi NEXT_PUBLIC_SUPABASE_URL dan ' +
  'NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu restart `npm run dev`.';
