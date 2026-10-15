'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, Loader2, UserPlus, UserRound } from 'lucide-react';
import { AuthMessage, AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { checkUsernameAvailable, normalizeUsername, signUpWithUsername, validateUsername } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * HALAMAN DAFTAR  (route: "/register")
 *
 * Pendaftaran memakai USERNAME + password (tanpa email), jadi TIDAK ADA
 * email konfirmasi. Karena itu, di Supabase WAJIB:
 *   Authentication -> Sign In / Providers -> Email -> matikan "Confirm email"
 *
 * Kalau lupa dimatikan, pendaftaran akan gagal dengan pesan yang menjelaskan.
 */

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<{ username?: string; password?: string; confirm?: string }>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [checkingName, setCheckingName] = React.useState(false);
  /** true = tersedia, false = sudah dipakai, null = belum/tidak bisa diperiksa */
  const [nameAvailable, setNameAvailable] = React.useState<boolean | null>(null);
  const [checkedName, setCheckedName] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const cleanUsername = normalizeUsername(username);

  /**
   * Cek ketersediaan username saat pengguna berhenti mengetik (debounce 500 ms),
   * supaya kesalahan ketahuan sebelum menekan tombol Daftar.
   */
  React.useEffect(() => {
    setNameAvailable(null);
    setCheckedName('');
    if (!cleanUsername || validateUsername(cleanUsername)) return;

    let active = true;
    setCheckingName(true);
    const timer = window.setTimeout(async () => {
      const available = await checkUsernameAvailable(cleanUsername);
      if (!active) return;
      setNameAvailable(available);
      setCheckedName(cleanUsername);
      setCheckingName(false);
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timer);
      setCheckingName(false);
    };
  }, [cleanUsername]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const nextErrors: { username?: string; password?: string; confirm?: string } = {};
    const usernameError = validateUsername(username);
    if (usernameError) nextErrors.username = usernameError;
    else if (nameAvailable === false) nextErrors.username = 'Username ini sudah dipakai. Coba yang lain.';

    if (!password) nextErrors.password = 'Password wajib diisi.';
    else if (password.length < 6) nextErrors.password = 'Password minimal 6 karakter.';

    if (!confirm) nextErrors.confirm = 'Ulangi password-mu.';
    else if (confirm !== password) nextErrors.confirm = 'Password dan ulangannya belum sama.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const result = await signUpWithUsername(username, password);

    if (!result.ok) {
      setMessage(result.message ?? 'Gagal mendaftar. Coba lagi.');
      setLoading(false);
      return;
    }

    // Sesi langsung aktif (tanpa konfirmasi email) -> masuk ke dashboard.
    try {
      window.localStorage.setItem('pft.lastUsername', normalizeUsername(username));
    } catch {
      // tidak penting
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <AuthShell
      title="Buat akun baru"
      subtitle="Cukup username dan password — tanpa email. Gratis."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Masuk di sini
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured ? (
        <AuthMessage tone="info">
          Form pendaftaran aktif setelah kredensial Supabase diisi. Lihat petunjuk di bawah.
        </AuthMessage>
      ) : null}

      {message ? <AuthMessage tone="error">{message}</AuthMessage> : null}

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

          {/* Umpan balik ketersediaan username */}
          {checkingName ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Memeriksa ketersediaan…
            </p>
          ) : nameAvailable === true ? (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> Username <strong>{cleanUsername}</strong> masih tersedia.
            </p>
          ) : nameAvailable === false ? (
            <p className="text-xs font-medium text-destructive">
              Username <strong>{cleanUsername}</strong> sudah dipakai.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Username saja, bukan email. 3–20 karakter: huruf kecil, angka, titik, garis bawah.
              Contoh: <em>budi</em>, <em>budi_01</em>
            </p>
          )}

          <FieldError>{errors.username}</FieldError>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              placeholder="Minimal 6 karakter"
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Ulangi Password</Label>
          <Input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            name="confirm"
            autoComplete="new-password"
            placeholder="Ketik ulang password yang sama"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={Boolean(errors.confirm)}
            disabled={loading}
          />
          <FieldError>{errors.confirm}</FieldError>
        </div>

        <Button
          type="submit"
          disabled={loading || nameAvailable === false || checkingName}
          className="mt-1 w-full"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Daftar
        </Button>
      </form>
    </AuthShell>
  );
}
