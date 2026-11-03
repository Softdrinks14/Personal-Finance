import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Duitku — Pencatat Keuangan Pribadi',
  description:
    'Catat pemasukan & pengeluaran, lihat grafik keuangan, dan scan screenshot mutasi bank otomatis dengan OCR. Dibuat dengan Next.js, Tailwind, Supabase, dan Tesseract.js.',
  keywords: ['keuangan pribadi', 'catatan keuangan', 'finance tracker', 'OCR mutasi bank'],
};

export const viewport: Viewport = {
  themeColor: '#0b1120',
};

/**
 * Skrip kecil yang dijalankan SEBELUM halaman dirender.
 *
 * Urutannya penting supaya layar tidak berkedip putih:
 *   1. Belum pernah memilih tema  -> DARK (ini default aplikasi).
 *   2. Pernah memilih "light"     -> class "dark" dilepas.
 *   3. Pernah memilih "dark"      -> class "dark" dipasang.
 *
 * `<html className="dark">` di bawah membuat tampilan awal (sebelum JavaScript
 * jalan) juga sudah gelap, jadi tidak ada kedipan terang sama sekali.
 */
const themeScript = `(function(){try{var saved=localStorage.getItem('pft.theme');var dark=saved!=='light';document.documentElement.classList.toggle('dark',dark);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
