'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'pft.theme';

/**
 * Tombol ganti mode terang / gelap.
 *
 * Default aplikasi = GELAP (lihat app/layout.tsx). Pilihan user disimpan di
 * localStorage supaya tetap sama saat dibuka lagi. `useState(true)` dipakai
 * sebagai tebakan awal karena class "dark" sudah dipasang di server; efek di
 * bawah menyamakannya dengan keadaan sebenarnya di browser.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // localStorage bisa diblokir; abaikan saja.
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
