-- =============================================================================
--  MIGRASI 002 — AUTENTIKASI MULTI-USER & ISOLASI DATA
--  Database: Supabase (PostgreSQL)
--
--  ⚠️  JALANKAN FILE INI HANYA JIKA kamu sudah pernah menjalankan schema.sql
--      sebelumnya (yaitu database sudah ada isinya).
--      Kalau database masih baru/kosong, cukup jalankan schema.sql terbaru —
--      tidak perlu migrasi ini.
--
--  CARA PAKAI:
--    1. Supabase Dashboard -> SQL Editor -> New query
--    2. Tempel SELURUH isi file ini, klik Run
--    3. Aman dijalankan berulang kali (idempoten)
--
--  APA YANG DILAKUKAN FILE INI:
--    1. Menambah kolom `user_id` pada `transactions` dan `categories`
--    2. Mengganti kebijakan RLS yang terbuka dengan `auth.uid() = user_id`
--    3. Membuat kategori bawaan otomatis untuk setiap pengguna baru
--    4. Menutup celah keamanan pada view `monthly_summary`
-- =============================================================================


-- =============================================================================
-- BAGIAN 1 — TAMBAH KOLOM user_id
-- =============================================================================

-- `on delete cascade` = kalau akun dihapus, semua datanya ikut terhapus.
-- Ini penting untuk privasi: tidak ada data "yatim" yang tertinggal.
alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.categories
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- default auth.uid() = kalau aplikasi lupa mengirim user_id, PostgreSQL
-- mengisinya sendiri dari sesi login. Jadi baris TIDAK MUNGKIN tersimpan
-- tanpa pemilik.
alter table public.transactions alter column user_id set default auth.uid();
alter table public.categories   alter column user_id set default auth.uid();

-- Index supaya filter "data milik saya" tetap cepat walau data sudah banyak.
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists categories_user_id_idx on public.categories (user_id);


-- =============================================================================
-- BAGIAN 2 — KATEGORI JADI MILIK MASING-MASING PENGGUNA
-- =============================================================================
-- Sebelumnya nama kategori unik secara global (satu daftar untuk semua orang).
-- Sekarang unik per pengguna, supaya tiap orang bebas mengubah kategorinya
-- sendiri tanpa mengganggu pengguna lain.

alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories drop constraint if exists categories_user_id_name_key;
alter table public.categories add constraint categories_user_id_name_key unique (user_id, name);


-- =============================================================================
-- BAGIAN 3 — HAPUS KEBIJAKAN LAMA YANG TERBUKA
-- =============================================================================
-- Kebijakan `using (true)` sebelumnya membuat SEMUA orang bisa membaca dan
-- menulis data SIAPA PUN. Kebijakan itu wajib dibuang sekarang.

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


-- =============================================================================
-- BAGIAN 4 — AKTIFKAN RLS + KEBIJAKAN "auth.uid() = user_id"
-- =============================================================================

alter table public.transactions enable row level security;
alter table public.categories   enable row level security;

-- ---- transactions ----
-- `to authenticated` artinya: pengguna anonim (belum login) TIDAK punya akses
-- sama sekali. `auth.uid()` adalah id pengguna dari token JWT-nya.

create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---- categories ----

create policy "categories_select_own"
  on public.categories for select
  to authenticated
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- BAGIAN 5 — KATEGORI BAWAAN UNTUK SETIAP PENGGUNA BARU
-- =============================================================================
-- Trigger ini berjalan otomatis begitu ada akun baru di auth.users.
-- Jadi setiap pengguna baru langsung punya 12 kategori siap pakai.
--
-- `security definer` diperlukan karena trigger berjalan sebagai pemilik fungsi
-- (bukan sebagai pengguna baru), sehingga bisa menulis menembus RLS.

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


-- =============================================================================
-- BAGIAN 6 — TUTUP CELAH KEAMANAN PADA VIEW
-- =============================================================================
-- PENTING: secara default, view di PostgreSQL berjalan dengan izin PEMILIKNYA
-- (bukan izin pengguna yang mengakses). Artinya view bisa MENEMBUS RLS dan
-- membocorkan data semua pengguna.
--
-- `security_invoker = on` membuat view mengikuti izin pengguna yang mengakses,
-- sehingga RLS tetap berlaku.

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


-- =============================================================================
-- BAGIAN 7 — CEK KETERSEDIAAN USERNAME
-- =============================================================================
-- Aplikasi memakai LOGIN USERNAME (bukan email). Di balik layar, username
-- diubah menjadi email internal "username@example.com" oleh lib/auth.ts.
--
-- Fungsi ini dipakai halaman /register untuk memberi tahu "username sudah
-- dipakai" SEBELUM pengguna menekan tombol Daftar.
--
-- `security definer` diperlukan karena tabel auth.users tidak bisa dibaca
-- oleh pengguna anonim; fungsi ini berjalan sebagai pemiliknya.
-- Yang dikembalikan hanya true/false — tidak ada data akun yang bocor.

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


-- =============================================================================
-- BAGIAN 8 — SELESAI
-- =============================================================================
-- Setelah ini:
--   1. Buka aplikasi -> daftar akun baru di /register
--   2. Data LAMA milikmu (yang belum punya user_id) tidak akan terlihat lagi
--      karena RLS. Kalau mau "mengklaim" data lama itu, jalankan SQL di
--      bagian bawah file ini SETELAH kamu mendaftar.
--
-- --- CARA MENGKLAIM DATA LAMA (opsional) ------------------------------------
-- Ganti email di bawah dengan email akun yang baru kamu daftarkan, lalu Run.
--
--   update public.transactions
--      set user_id = (select id from auth.users where email = 'emailkamu@gmail.com')
--    where user_id is null;
--
--   update public.categories
--      set user_id = (select id from auth.users where email = 'emailkamu@gmail.com')
--    where user_id is null;
--
-- --- CEK HASIL --------------------------------------------------------------
--   select count(*) as jumlah_transaksi, count(user_id) as punya_pemilik
--     from public.transactions;
-- ---------------------------------------------------------------------------
