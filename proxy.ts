import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';

/* =========================================================================
 * PROXY (dulu bernama "middleware") — PENJAGA PINTU
 * -------------------------------------------------------------------------
 * Di Next.js 16, file `middleware.ts` diganti nama menjadi `proxy.ts` dan
 * fungsinya menjadi `proxy()`. Fungsinya sama persis: kode yang berjalan di
 * server SEBELUM halaman dirender.
 *
 * Analogi: ini satpam di pintu masuk.
 *   - Belum login?  -> dialihkan ke /login
 *   - Sudah login tapi membuka /login atau /register? -> dialihkan ke dashboard
 *
 * Karena berjalan di server, pengguna tidak bisa melewatinya dengan mematikan
 * JavaScript di browser.
 *
 * Proxy juga bertugas MENYEGARKAN sesi: token Supabase punya masa berlaku
 * terbatas, dan `getUser()` di bawah ini yang memperpanjangnya. Tanpa langkah
 * ini, pengguna akan tiba-tiba ter-logout.
 *
 * ⚠️ PENTING SOAL KEAMANAN:
 *   Penjagaan di file ini bagus untuk pengalaman pengguna (redirect rapi),
 *   TAPI bukan lapisan keamanan yang sesungguhnya. Yang benar-benar melindungi
 *   data adalah Row Level Security di database (lihat supabase/schema.sql),
 *   karena aturan itu ditegakkan oleh PostgreSQL sendiri untuk SETIAP query.
 * ========================================================================= */

/** Halaman yang boleh dibuka tanpa login. */
const PUBLIC_PAGES = ['/login', '/register'];

/** Awalan path yang boleh dibuka tanpa login. */
const PUBLIC_PREFIXES = [
  '/api/', // route API memeriksa sendiri & membalas 401, bukan redirect
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Supabase belum diisi: arahkan ke /login, karena halaman itu yang
  // menampilkan petunjuk setup. Route API dibiarkan lewat supaya bisa
  // membalas 503 JSON (bukan redirect) — pemanggilnya program, bukan browser.
  if (!isSupabaseConfigured) {
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = '/login';
    setupUrl.search = '';
    return NextResponse.redirect(setupUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Cookie baru harus ditulis ke DUA tempat:
        //  1. `request`  -> supaya permintaan saat ini juga melihat sesi baru
        //  2. `response` -> supaya browser menyimpannya untuk permintaan berikutnya
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() memverifikasi token ke server Supabase sekaligus menyegarkannya.
  // Jangan diganti getSession(): itu hanya membaca cookie yang bisa dipalsukan.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  // --- 1. Belum login & membuka halaman terproteksi -> tendang ke /login ---
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Ingat halaman yang tadi dituju, supaya setelah login bisa kembali ke sana.
    if (pathname !== '/') {
      const target = `${pathname}${search}`;
      // Cegah open redirect: hanya izinkan path internal.
      if (target.startsWith('/') && !target.startsWith('//')) {
        url.searchParams.set('redirectTo', target);
      }
    }
    return NextResponse.redirect(url);
  }

  // --- 2. Sudah login tapi membuka /login atau /register -> ke dashboard ---
  if (user && PUBLIC_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /**
   * Jalankan proxy di semua halaman, KECUALI:
   *  - berkas statis Next.js (_next/static, _next/image)
   *  - favicon & berkas gambar
   * Menjalankannya untuk berkas statis hanya memperlambat aplikasi.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)',
  ],
};
