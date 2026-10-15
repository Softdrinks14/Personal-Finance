import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase-server';

/**
 * GUARD UNTUK SEMUA ROUTE API
 * ------------------------------------------------------------------
 * Setiap route API WAJIB memeriksa siapa pemanggilnya. Tanpa ini, endpoint
 * bisa dipakai siapa saja yang tahu alamatnya.
 *
 * Kenapa masih perlu, padahal ada middleware?
 *   - Middleware sengaja TIDAK mengalihkan (redirect) permintaan /api/*,
 *     karena pemanggilnya program (bukan browser). Jadi pemeriksaan harus
 *     dilakukan di sini, dengan balasan JSON 401 yang jelas.
 *   - Ini juga melindungi kalau matcher middleware suatu saat diubah.
 */
export async function requireApiUser() {
  const { user, supabase } = await getServerUser();

  if (!supabase) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json(
        {
          error: 'Supabase belum dikonfigurasi.',
          hint: 'Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local',
        },
        { status: 503 },
      ),
    };
  }

  if (!user) {
    return {
      user: null,
      supabase,
      error: NextResponse.json(
        { error: 'Belum login.', hint: 'Endpoint ini hanya bisa dipakai oleh pengguna yang sudah masuk.' },
        { status: 401 },
      ),
    };
  }

  return { user, supabase, error: null };
}
