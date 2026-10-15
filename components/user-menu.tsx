'use client';

import * as React from 'react';
import { Loader2, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/**
 * Bagian kanan navbar: username pengguna + tombol keluar.
 * Ada dialog konfirmasi supaya tidak ter-logout karena salah klik.
 */
export function UserMenu() {
  const { username, signOut, loading } = useAuth();
  const [confirming, setConfirming] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  if (loading) {
    return <div className="h-9 w-9 animate-pulse rounded-md bg-muted" aria-hidden="true" />;
  }

  if (!username) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className="flex max-w-[150px] items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
          title={`Masuk sebagai ${username}`}
        >
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate font-medium text-foreground">{username}</span>
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirming(true)}
          aria-label="Keluar dari akun"
          title="Keluar"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Keluar dari akun?"
        description="Datamu tetap aman tersimpan. Kamu bisa masuk lagi kapan saja."
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={signingOut}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Ya, keluar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Kamu sedang masuk sebagai <strong className="font-medium text-foreground">{username}</strong>.
        </p>
      </Dialog>
    </>
  );
}
