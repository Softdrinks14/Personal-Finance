'use client';

import { AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Ditampilkan kalau kredensial Supabase belum diisi di `.env.local`.
 *
 * Sejak fitur login ditambahkan, aplikasi MEMERLUKAN Supabase — tidak ada lagi
 * mode LocalStorage. Jadi kalau belum diisi, kita jelaskan apa yang harus
 * dilakukan alih-alih menampilkan error teknis.
 */
export function SupabaseSetupNotice() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">Supabase belum dikonfigurasi</p>
          <p className="text-muted-foreground">
            Aplikasi ini memakai Supabase untuk <strong>login</strong> dan menyimpan data, jadi
            kredensialnya wajib diisi.
          </p>
          <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
            <li>
              Salin <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local.example</code>{' '}
              menjadi <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>
            </li>
            <li>
              Isi <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> dan{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
              dari Supabase → Project Settings → API
            </li>
            <li>
              Jalankan <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/schema.sql</code> di
              SQL Editor Supabase
            </li>
            <li>
              Restart: <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run dev</code>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
