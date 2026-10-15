import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

/**
 * Koneksi Supabase untuk SISI SERVER (Server Component, Route Handler,
 * Server Action).
 *
 * Bedanya dengan versi browser:
 *   - Membaca & menulis cookie lewat `next/headers`, bukan document.cookie.
 *   - Dipakai middleware.ts dan app/api/** untuk memastikan permintaan yang
 *     masuk benar-benar berasal dari pengguna yang sudah login.
 *
 * Karena cookie sesi ikut terkirim, PostgreSQL tahu siapa pengguna ini
 * (auth.uid()) dan Row Level Security otomatis membatasi datanya.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component tidak boleh menulis cookie. Ini normal:
          // middleware.ts yang bertugas menyegarkan sesi.
        }
      },
    },
  });
}

/**
 * Ambil pengguna yang sedang login dari sisi server.
 * Mengembalikan `user: null` kalau belum login atau Supabase belum diisi.
 *
 * `getUser()` (bukan `getSession()`) sengaja dipakai karena ia memverifikasi
 * token ke server Supabase — `getSession()` hanya mempercayai isi cookie.
 */
export async function getServerUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { user: null, supabase: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabase };
}
