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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

/**
 * Skrip kecil yang dijalankan SEBELUM halaman dirender.
 * Tugasnya: pasang class "dark" lebih awal supaya layar tidak berkedip putih
 * saat user memilih mode gelap.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('pft.theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
