-- =============================================================================
--  SKEMA DATABASE — PERSONAL FINANCE TRACKER
--  Database: Supabase (PostgreSQL)
--
--  CARA PAKAI:
--    1. Buka project Supabase kamu
--    2. Menu kiri -> SQL Editor -> "New query"
--    3. Tempel SELURUH isi file ini, lalu klik "Run"
--    4. Kalau berhasil, tabel `categories` & `transactions` akan muncul di
--       menu "Table Editor" beserta kategori bawaan.
-- =============================================================================

-- gen_random_uuid() dipakai untuk membuat id acak (UUID).
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABEL: categories
--    Analogi: ini "daftar kotak label" tempat transaksi dikelompokkan.
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- 'income' = hanya untuk pemasukan, 'expense' = hanya pengeluaran,
  -- 'both' = bisa dipakai keduanya.
  type        text not null default 'expense' check (type in ('income', 'expense', 'both')),
  -- Warna untuk grafik & penanda di tabel (format HEX).
  color       text not null default '#64748b',
  created_at  timestamptz not null default now()
);

comment on table public.categories is 'Kategori transaksi keuangan (Makanan, Transportasi, Gaji, dst).';

-- -----------------------------------------------------------------------------
-- 2. TABEL: transactions
--    Analogi: buku kas. Satu baris = satu kejadian uang masuk/keluar.
--    Catatan penting: `amount` SELALU angka positif.
--    Arah uang ditentukan oleh kolom `type`, bukan oleh tanda minus.
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(14, 2) not null check (amount > 0),
  date        date not null,
  category_id uuid references public.categories (id) on delete set null,
  note        text,
  -- 'manual' = diketik user, 'ocr' = hasil scan screenshot mutasi bank.
  source      text not null default 'manual' check (source in ('manual', 'ocr')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.transactions is 'Catatan pemasukan & pengeluaran. amount selalu positif.';

-- -----------------------------------------------------------------------------
-- 3. INDEX — supaya pencarian & filter tetap cepat walau data sudah banyak
-- -----------------------------------------------------------------------------
create index if not exists transactions_date_idx        on public.transactions (date desc);
create index if not exists transactions_type_idx        on public.transactions (type);
create index if not exists transactions_category_idx    on public.transactions (category_id);
create index if not exists transactions_created_at_idx  on public.transactions (created_at desc);

-- -----------------------------------------------------------------------------
-- 4. TRIGGER — isi updated_at otomatis setiap baris diubah
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
--
--    PENTING & WAJIB DIBACA:
--    Aplikasi ini belum memakai fitur login. Supaya bisa langsung dipakai,
--    kebijakan di bawah mengizinkan siapa saja yang memegang "anon key"
--    untuk membaca & menulis data.
--
--    Artinya: SIAPA PUN yang tahu URL + anon key project-mu bisa melihat dan
--    mengubah datamu. Untuk aplikasi pribadi yang hanya kamu pakai, ini
--    umumnya cukup. Kalau nanti mau dipakai banyak orang, aktifkan Supabase
--    Auth lalu ganti kebijakan di bawah menjadi `auth.uid() = user_id`
--    (tambahkan kolom `user_id uuid references auth.users(id)` dulu).
-- -----------------------------------------------------------------------------
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "categories_full_access" on public.categories;
create policy "categories_full_access"
  on public.categories
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "transactions_full_access" on public.transactions;
create policy "transactions_full_access"
  on public.transactions
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- 6. DATA AWAL — kategori bawaan
--    ON CONFLICT DO NOTHING = aman dijalankan berkali-kali (tidak dobel).
-- -----------------------------------------------------------------------------
insert into public.categories (name, type, color) values
  ('Makanan & Minuman', 'expense', '#f97316'),
  ('Transportasi',      'expense', '#0ea5e9'),
  ('Tagihan & Utilitas','expense', '#8b5cf6'),
  ('Belanja',           'expense', '#ec4899'),
  ('Hiburan',           'expense', '#f43f5e'),
  ('Kesehatan',         'expense', '#14b8a6'),
  ('Pendidikan',        'expense', '#6366f1'),
  ('Lain-lain',         'expense', '#64748b'),
  ('Gaji',              'income',  '#10b981'),
  ('Bonus & THR',       'income',  '#22c55e'),
  ('Usaha / Freelance', 'income',  '#84cc16'),
  ('Investasi',         'both',    '#eab308')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 7. VIEW BANTUAN (opsional)
--    Ringkasan pemasukan/pengeluaran per bulan. Enak dibuka langsung dari
--    Supabase, atau dipakai kalau nanti mau bikin laporan tambahan.
-- -----------------------------------------------------------------------------
create or replace view public.monthly_summary as
select
  to_char(date_trunc('month', date), 'YYYY-MM')                          as month,
  coalesce(sum(case when type = 'income'  then amount end), 0)           as total_income,
  coalesce(sum(case when type = 'expense' then amount end), 0)           as total_expense,
  coalesce(sum(case when type = 'income'  then amount else -amount end), 0) as net_balance,
  count(*)                                                               as transaction_count
from public.transactions
group by 1
order by 1 desc;

-- -----------------------------------------------------------------------------
-- 8. CEK HASIL
-- -----------------------------------------------------------------------------
-- Jalankan dua baris ini untuk memastikan semuanya sudah masuk:
--   select count(*) from public.categories;
--   select * from public.monthly_summary limit 6;
