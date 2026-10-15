'use client';

import { getSupabase, SUPABASE_URL } from './supabase';

/* =========================================================================
 * AUTENTIKASI (SISI BROWSER) — LOGIN DENGAN USERNAME
 * -------------------------------------------------------------------------
 * Supabase Auth sebenarnya hanya mengenal login lewat EMAIL. Supaya pengguna
 * bisa memakai username saja (lebih mudah diingat daripada email), kita pakai
 * trik standar: username diubah menjadi alamat email "internal" yang tidak
 * pernah dikirimi surat.
 *
 *   username "budi"  ->  email internal "budi@example.com"
 *
 * `example.com` bukan domain milik siapa pun (direservasi RFC 2606), jadi
 * tidak ada email yang benar-benar terkirim ke sana.
 *
 * KEUNTUNGAN cara ini:
 *   - Supabase menjamin email unik -> username otomatis unik juga.
 *     Tidak perlu tabel tambahan hanya untuk menjaga keunikan username.
 *   - Tidak ada perubahan pada skema Supabase Auth.
 *
 * KONSEKUENSI PENTING:
 *   Konfirmasi email WAJIB dimatikan di Supabase, karena alamat email internal
 *   itu tidak bisa dibuka oleh siapa pun.
 *   Authentication -> Sign In / Providers -> Email -> matikan "Confirm email".
 * ========================================================================= */

/**
 * Domain untuk membentuk email internal dari username.
 *
 * ⚠️ JANGAN pakai "example.com"!
 * Supabase MENOLAK domain itu dengan pesan:
 *     Email address "nama@example.com" is invalid
 * karena example.com termasuk domain khusus (direservasi RFC 2606) yang
 * tidak mungkin menerima surat.
 *
 * Kita pakai domain proyek Supabase milikmu sendiri, contoh:
 *     uqcmuepappvhzqyowywj.supabase.co
 * Domain itu benar-benar terdaftar, jadi tidak mungkin ditolak validator.
 * Tidak ada surat yang dikirim ke sana karena konfirmasi email dimatikan.
 *
 * Diambil otomatis dari NEXT_PUBLIC_SUPABASE_URL supaya tidak perlu diubah
 * manual saat proyeknya berbeda.
 */
export const USERNAME_EMAIL_DOMAIN: string = (() => {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return 'localhost';
  }
})();

/** Aturan username yang diperbolehkan. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export interface AuthResult {
  ok: boolean;
  /** pesan siap tampil ke pengguna */
  message?: string;
}

/**
 * Rapikan username: buang spasi, jadikan huruf kecil semua.
 * "  Budi.Santoso " -> "budi.santoso"
 *
 * Huruf kecil penting supaya "Budi" dan "budi" dianggap orang yang sama —
 * kalau tidak, pengguna bisa terkunci dari akunnya sendiri karena salah kapital.
 */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Ubah username menjadi email internal yang dipakai Supabase Auth. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

/**
 * Periksa format username.
 * Mengembalikan pesan kesalahan, atau null kalau sudah benar.
 */
export function validateUsername(input: string): string | null {
  const username = normalizeUsername(input);

  if (!username) return 'Username wajib diisi.';
  if (username.length < USERNAME_MIN) return `Username minimal ${USERNAME_MIN} karakter.`;
  if (username.length > USERNAME_MAX) return `Username maksimal ${USERNAME_MAX} karakter.`;

  if (!USERNAME_PATTERN.test(username)) {
    return 'Username hanya boleh berisi huruf, angka, titik, dan garis bawah (tanpa spasi).';
  }
  if (username.startsWith('.') || username.endsWith('.')) {
    return 'Username tidak boleh diawali atau diakhiri titik.';
  }

  return null;
}

/**
 * Terjemahkan pesan error Supabase Auth ke bahasa Indonesia.
 * Pesan asli tetap dicetak ke console supaya mudah dilacak saat debug.
 */
function translateAuthError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'Username atau password salah. Cek lagi penulisannya.';
  }
  if (text.includes('email not confirmed')) {
    return 'Akun ini belum dikonfirmasi. Di halaman Supabase, matikan "Confirm email" (Authentication → Sign In / Providers → Email).';
  }
  if (text.includes('user already registered') || text.includes('already been registered')) {
    return 'Username ini sudah dipakai. Coba username lain.';
  }
  if (text.includes('password should be at least')) {
    return 'Password terlalu pendek. Minimal 6 karakter.';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return (
      'Supabase sedang membatasi pengiriman email. Ini terjadi karena "Confirm email" masih aktif. ' +
      'Matikan di Authentication → Sign In / Providers → Email, lalu tunggu ±1 jam dan coba lagi.'
    );
  }
  if (text.includes('is invalid') && text.includes('email address')) {
    return (
      'Supabase menolak alamat email internal yang dipakai aplikasi. ' +
      'Pastikan kode ini memakai versi terbaru (domain email diambil dari URL proyek Supabase, bukan example.com).'
    );
  }
  if (text.includes('signups not allowed')) {
    return 'Pendaftaran akun baru sedang dimatikan di pengaturan Supabase.';
  }
  if (text.includes('password should contain') || text.includes('weak password')) {
    return 'Password terlalu lemah. Gunakan kombinasi huruf dan angka.';
  }
  if (text.includes('duplicate key') || text.includes('unique constraint')) {
    return 'Username ini sudah dipakai. Coba username lain.';
  }

  return message;
}

/**
 * Cek apakah username masih bisa dipakai.
 *
 * Mengembalikan:
 *   true  -> masih tersedia
 *   false -> sudah dipakai
 *   null  -> TIDAK BISA DIPERIKSA (mis. jaringan bermasalah atau fungsi
 *            `username_taken` belum ada karena migrasi belum dijalankan)
 *
 * `null` sengaja dibedakan dari `true`. Kalau pemeriksaan gagal, kita tidak
 * boleh menjanjikan "username tersedia" — nanti pengguna kecewa saat ditolak.
 * Keunikan tetap dijamin oleh Supabase saat signUp.
 */
export async function checkUsernameAvailable(username: string): Promise<boolean | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('username_taken', {
    candidate: normalizeUsername(username),
  });

  if (error) {
    console.warn('[auth] cek username dilewati:', error.message);
    return null;
  }

  return data !== true;
}

/** Masuk memakai username & password. */
export async function signInWithUsername(username: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Supabase belum dikonfigurasi.' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    console.error('[auth] signIn gagal:', error.message);
    return { ok: false, message: translateAuthError(error.message) };
  }

  return { ok: true };
}

/**
 * Mendaftar akun baru dengan username & password.
 * Username disimpan di `user_metadata.username` supaya bisa ditampilkan di navbar.
 */
export async function signUpWithUsername(username: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Supabase belum dikonfigurasi.' };
  }

  const clean = normalizeUsername(username);

  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(clean),
    password,
    options: {
      data: { username: clean },
    },
  });

  if (error) {
    console.error('[auth] signUp gagal:', error.message);
    return { ok: false, message: translateAuthError(error.message) };
  }

  // Kalau "Confirm email" masih aktif, Supabase TIDAK memberi sesi.
  // Untuk login username murni, pengaturan itu harus dimatikan.
  if (data.user && !data.session) {
    return {
      ok: false,
      message:
        'Akun dibuat, tapi konfirmasi email masih aktif di Supabase sehingga kamu belum bisa masuk. ' +
        'Matikan "Confirm email" (Authentication → Sign In / Providers → Email), lalu daftar/masuk lagi.',
    };
  }

  return { ok: true };
}

/**
 * Keluar dari akun.
 * Sesi dihapus di server Supabase lalu cookie lokal dibersihkan.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) console.error('[auth] signOut gagal:', error.message);
}

/**
 * Ambil username dari objek user Supabase.
 * Diambil dari metadata; kalau tidak ada (akun lama), pakai bagian depan email.
 */
export function usernameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string | null {
  if (!user) return null;

  const fromMetadata = user.user_metadata?.username;
  if (typeof fromMetadata === 'string' && fromMetadata.length > 0) return fromMetadata;

  if (user.email) return user.email.split('@')[0];

  return null;
}
