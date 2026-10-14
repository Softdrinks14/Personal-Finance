'use client';

import { Navbar } from '@/components/layout/navbar';

/**
 * Kerangka halaman: navbar di atas, konten di tengah, footer kecil di bawah.
 * Semua halaman memakai komponen ini supaya tampilannya konsisten.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="container flex-1 py-6">{children}</main>

      <footer className="border-t border-border py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>
            Dibuat dengan Next.js + Tailwind CSS + Supabase + Tesseract.js. Data keuanganmu tidak
            dikirim ke mana-mana kecuali database milikmu sendiri.
          </p>
          <p>© {new Date().getFullYear()} Duitku</p>
        </div>
      </footer>
    </div>
  );
}
