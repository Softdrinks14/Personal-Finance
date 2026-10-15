'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { signOut as performSignOut, usernameFromUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

/* =========================================================================
 * AUTH PROVIDER
 * -------------------------------------------------------------------------
 * Menyimpan "siapa yang sedang login" dan membagikannya ke seluruh aplikasi.
 *
 * Ada DUA sumber kebenaran, dan keduanya harus sinkron:
 *   1. Server (proxy.ts)   -> menentukan halaman mana yang boleh dibuka.
 *   2. Provider ini         -> menentukan username & tombol keluar di navbar.
 *
 * Karena sesi disimpan di cookie, keduanya membaca sesi yang sama.
 * ========================================================================= */

interface AuthContextValue {
  /** null berarti belum login */
  user: User | null;
  /** Username yang ditampilkan di navbar */
  username: string | null;
  /** true selama status login belum diketahui — dipakai untuk menahan
   *  pemuatan data supaya tidak memicu error "Gagal memuat data" palsu. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    // Status awal: tanya ke server siapa yang sedang login.
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    // Dengarkan perubahan berikutnya (login, logout, token kedaluwarsa),
    // termasuk kalau sesi diubah di tab browser lain.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = React.useCallback(async () => {
    await performSignOut();
    setUser(null);
    // replace() bukan push(): supaya tombol "kembali" browser tidak
    // mengembalikan pengguna ke halaman dashboard yang sudah tidak boleh dibuka.
    router.replace('/login');
    router.refresh();
  }, [router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, username: usernameFromUser(user), loading, signOut }),
    [user, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() harus dipakai di dalam <AuthProvider>.');
  }
  return context;
}
