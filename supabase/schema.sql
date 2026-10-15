-- =============================================================================
--  SKEMA DATABASE — PERSONAL FINANCE TRACKER (MULTI-USER)
--  Database: Supabase (PostgreSQL)
--
--  CARA PAKAI:
--    1. Buka project Supabase kamu
--    2. Menu kiri -> SQL Editor -> "New query"
--    3. Tempel SELURUH isi file ini, lalu klik "Run"
--    4. Setelah itu buka aplikasi dan DAFTAR akun di halaman /register
--
--  File ini adalah skema LENGKAP untuk pemasangan baru. Aman dijalankan
--  berulang kali. Kalau database-mu sudah ada isinya dan ingin menambahkan
--  fitur login, pakai `supabase/migrations/002_multi_user_auth.sql`.
--
--  TENTANG KEAMANAN:
--    Setiap baris di tabel `transactions` dan `categories` punya kolom
--    `user_id`. Row Level Security (RLS) memastikan pengguna hanya bisa
--    menyentuh baris miliknya sendiri — aturan ini ditegakkan oleh PostgreSQL,
--    bukan oleh kode aplikasi, jadi tidak bisa dilewati dari sisi browser.
-- =============================================================================

-- gen_random_uuid() dipakai untuk membuat id acak (UUID).
create extension if not exists "pgcrypto";


-- -----------------------------------------------------------------------------
-- 1. TABEL: categories
--    Analogi: "daftar kotak label" tempat transaksi dikelompokkan.
--    Dimiliki per pengguna — setiap orang punya daftar kategorinya sendiri.
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  name        text not null,
  -- 'income' = hanya untuk pemasukan, 'expense' = hanya pengeluaran,
  -- 'both' = bisa dipakai keduanya.
  type        text not null default 'expense' check (type in ('income', 'expense', 'both')),
  -- Warna untuk grafik & penanda di tabel (format HEX).
  color       text not null default '#64748b',
  created_at  timestamptz not null default now()
);

comment on table public.categories is 'Kategori transaksi, dipisah per pengguna (user_id).';

-- Nama kategori unik PER PENGGUNA, bukan global.
alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories drop constraint if exists categories_user_id_name_key;
alter table public.categories add constraint categories_user_id_name_key unique (user_id, name);


-- -----------------------------------------------------------------------------
-- 2. TABEL: transactions
--    Analogi: buku kas. Satu baris = satu kejadian uang masuk/keluar.
--    Catatan penting: `amount` SELALU angka positif.
--    Arah uang ditentukan oleh kolom `type`, bukan oleh tanda minus.
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
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

comment on table public.transactions is 'Catatan pemasukan & pengeluaran per pengguna. amount selalu positif.';

-- default auth.uid() = kalau aplikasi lupa mengirim user_id, PostgreSQL
-- mengisinya sendiri dari sesi login. Baris tidak mungkin tersimpan tanpa pemilik.
alter table public.transactions alter column user_id set default auth.uid();
alter table public.categories   alter column user_id set default auth.uid();


-- -----------------------------------------------------------------------------
-- 3. INDEX — supaya pencarian & filter tetap cepat walau data sudah banyak
-- -----------------------------------------------------------------------------
create index if not exists transactions_user_id_idx    on public.transactions (user_id);
create index if not exists transactions_user_date_idx  on public.transactions (user_id, date desc);
create index if not exists transactions_date_idx       on public.transactions (date desc);
create index if not exists transactions_type_idx       on public.transactions (type);
create index if not exists transactions_category_idx   on public.transactions (category_id);
create index if not exists categories_user_id_idx      on public.categories (user_id);


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
-- 5. ROW LEVEL SECURITY (RLS) — INTI DARI ISOLASI DATA
--
--    Aturan: sebuah baris hanya boleh disentuh kalau kolom `user_id`-nya
--    sama dengan `auth.uid()` (id pengguna dari token JWT yang sedang aktif).
--
--    Policy dibuat terpisah untuk SELECT / INSERT / UPDATE / DELETE supaya
--    jelas operasi mana yang diizinkan.
--
--    `to authenticated` = pengguna yang BELUM login tidak punya akses
--    sama sekali (bukan hanya "data kosong", tapi benar-benar ditolak).
-- -----------------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.categories   enable row level security;

-- Hapus dulu policy lama (versi aplikasi yang belum ada login) supaya tidak
-- ada kebijakan `using (true)` yang tersisa dan membuka akses.
drop policy if exists "categories_full_access" on public.categories;
drop policy if exists "transactions_full_access" on public.transactions;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "transactions_select_own"
  on public.transactions for select to authenticated
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete to authenticated
  using (auth.uid() = user_id);

create policy "categories_select_own"
  on public.categories for select to authenticated
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert to authenticated
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories for delete to authenticated
  using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 6. KATEGORI BAWAAN UNTUK SETIAP PENGGUNA BARU
--
--    Trigger ini berjalan otomatis begitu ada akun baru di auth.users,
--    sehingga setiap pengguna baru langsung punya 12 kategori siap pakai.
--
--    `security definer` = fungsi berjalan sebagai pemiliknya (bukan sebagai
--    pengguna baru), sehingga bisa menulis menembus RLS.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, type, color) values
    (new.id, 'Makanan & Minuman', 'expense', '#f97316'),
    (new.id, 'Transportasi',      'expense', '#0ea5e9'),
    (new.id, 'Tagihan & Utilitas','expense', '#8b5cf6'),
    (new.id, 'Belanja',           'expense', '#ec4899'),
    (new.id, 'Hiburan',           'expense', '#f43f5e'),
    (new.id, 'Kesehatan',         'expense', '#14b8a6'),
    (new.id, 'Pendidikan',        'expense', '#6366f1'),
    (new.id, 'Lain-lain',         'expense', '#64748b'),
    (new.id, 'Gaji',              'income',  '#10b981'),
    (new.id, 'Bonus & THR',       'income',  '#22c55e'),
    (new.id, 'Usaha / Freelance', 'income',  '#84cc16'),
    (new.id, 'Investasi',         'both',    '#eab308')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 7. VIEW RINGKASAN BULANAN
--
--    PENTING: secara default view di PostgreSQL berjalan dengan izin PEMILIKNYA,
--    bukan izin pengguna yang mengakses. Kalau dibiarkan, view ini bisa
--    MENEMBUS RLS dan membocorkan data semua pengguna.
--    `security_invoker = on` membuat view mengikuti izin pengaksesnya.
-- -----------------------------------------------------------------------------
drop view if exists public.monthly_summary;

create view public.monthly_summary
with (security_invoker = on)
as
select
  user_id,
  to_char(date_trunc('month', date), 'YYYY-MM')                             as month,
  coalesce(sum(case when type = 'income'  then amount end), 0)              as total_income,
  coalesce(sum(case when type = 'expense' then amount end), 0)              as total_expense,
  coalesce(sum(case when type = 'income'  then amount else -amount end), 0) as net_balance,
  count(*)                                                                  as transaction_count
from public.transactions
group by user_id, date_trunc('month', date)
order by date_trunc('month', date) desc;

grant select on public.monthly_summary to authenticated;


-- -----------------------------------------------------------------------------
-- 9. CEK KETERSEDIAAN USERNAME
--
--    Aplikasi memakai LOGIN USERNAME (bukan email). Di balik layar, username
--    diubah menjadi email internal "username@example.com" oleh lib/auth.ts.
--
--    Fungsi ini dipakai halaman /register untuk memberi tahu "username sudah
--    dipakai" SEBELUM pengguna menekan tombol Daftar.
--
--    `security definer` diperlukan karena tabel auth.users tidak bisa dibaca
--    oleh pengguna anonim; fungsi ini berjalan sebagai pemiliknya.
--    Yang dikembalikan hanya true/false — tidak ada data akun yang bocor.
-- -----------------------------------------------------------------------------
create or replace function public.username_taken(candidate text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
      from auth.users
     -- Bandingkan HANYA bagian sebelum '@'. Domain email internal diambil
     -- otomatis dari URL proyek Supabase (bukan example.com yang ditolak
     -- Supabase), jadi fungsi ini sengaja tidak bergantung pada domain.
     where split_part(lower(email), '@', 1) = lower(trim(candidate))
  );
$$;

grant execute on function public.username_taken(text) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 10. CEK HASIL
-- -----------------------------------------------------------------------------
-- Jalankan dua baris ini untuk memastikan semuanya sudah masuk:
--   select count(*) from public.categories;
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
--
-- `rowsecurity` harus bernilai `t` (true) untuk `transactions` dan `categories`.
--
-- Uji RLS dari SQL Editor (berperan sebagai pengguna anon):
--   select count(*) from public.transactions;   -- harus 0 baris setelah login
-- -----------------------------------------------------------------------------
