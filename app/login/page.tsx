'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn, UserRound } from 'lucide-react';
import { AuthMessage, AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { normalizeUsername, signInWithUsername, validateUsername } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * HALAMAN LOGIN  (route: "/login")
 *
 * Login memakai USERNAME + password (tanpa email).
 * Di balik layar, username diubah menjadi email internal oleh lib/auth.ts —
 * lihat penjelasan lengkapnya di file itu.
 *
 * Penjagaan rute ada di proxy.ts: kalau sudah login lalu membuka /login,
 * pengguna langsung dialihkan ke dashboard.
 */

/** Terima hanya path internal, supaya tidak bisa diarahkan ke situs luar. */
function safeRedirect(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = safeRedirect(searchParams.get('redirectTo'));
  const urlError = searchParams.get('error');

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [savedUsername, setSavedUsername] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<{ username?: string; password?: string }>({});
  const [message, setMessage] = React.useState<string | null>(
    urlError ? 'Tautan tidak valid atau sudah kedaluwarsa. Coba masuk lagi.' : null,
  );
  const [loading, setLoading] = React.useState(false);

  /** Ingat username terakhir supaya tidak perlu mengetik ulang setelah keluar. */
  React.useEffect(() => {
    try {
      const last = window.localStorage.getItem('pft.lastUsername');
      if (last) {
        setSavedUsername(last);
        setUsername(last);
      }
    } catch {
      // localStorage bisa diblokir; abaikan.
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const nextErrors: { username?: string; password?: string } = {};
    const usernameError = validateUsername(username);
    if (usernameError) nextErrors.username = usernameError;
    if (!password) nextErrors.password = 'Password wajib diisi.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const result = await signInWithUsername(username, password);

    if (!result.ok) {
      setMessage(result.message ?? 'Gagal masuk. Coba lagi.');
      setLoading(false);
      return;
    }

    try {
      window.localStorage.setItem('pft.lastUsername', normalizeUsername(username));
    } catch {
      // tidak penting
    }

    // replace() supaya tombol "kembali" tidak membawa ke halaman login lagi.
    router.replace(redirectTo);
    // refresh() memaksa server (termasuk proxy) membaca ulang cookie sesi.
    router.refresh();
  };

  return (
    <AuthShell
      title="Masuk ke akunmu"
      subtitle="Cukup username dan password — tanpa email."
      footer={
        <>
          Belum punya akun?{' '}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Daftar sekarang
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured ? (
        <AuthMessage tone="info">
          Form login aktif setelah kredensial Supabase diisi. Lihat petunjuk di bawah.
        </AuthMessage>
      ) : null}

      {message ? <AuthMessage tone="error">{message}</AuthMessage> : null}

      {redirectTo !== '/' ? (
        <AuthMessage tone="info">
          Masuk dulu untuk membuka halaman <code className="text-xs">{redirectTo}</code>.
        </AuthMessage>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="mis. budi"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={Boolean(errors.username)}
              disabled={loading}
              className="pl-9"
            />
          </div>
          <FieldError>{errors.username}</FieldError>
          {savedUsername && username === savedUsername ? (
            <p className="text-xs text-muted-foreground">
              Terakhir kamu masuk sebagai <strong className="font-medium">{savedUsername}</strong>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Username saja, bukan email. Contoh: <em>budi</em>, <em>budi_01</em>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              disabled={loading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError>{errors.password}</FieldError>
        </div>

        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Masuk
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  // useSearchParams() butuh Suspense saat halaman dirender statis.
  return (
    <React.Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Memuat…</div>}
    >
      <LoginForm />
    </React.Suspense>
  );
}
