'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cloud, HardDrive, LayoutDashboard, ScanLine, Wallet } from 'lucide-react';
import { useData } from '@/components/data-provider';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Riwayat & Laporan', icon: Wallet },
  { href: '/upload', label: 'Scan Screenshot', icon: ScanLine },
];

export function Navbar() {
  const pathname = usePathname();
  const { mode, modeLabel } = useData();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight">Duitku</span>
            <span className="text-[11px] text-muted-foreground">Pencatat Keuangan Pribadi</span>
          </span>
        </Link>

        {/* Menu navigasi */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status penyimpanan + tombol tema */}
        <div className="flex items-center gap-2">
          <Badge tone={mode === 'supabase' ? 'income' : 'warning'} title={modeLabel}>
            {mode === 'supabase' ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
            <span className="hidden sm:inline">{mode === 'supabase' ? 'Supabase' : 'Local'}</span>
          </Badge>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
