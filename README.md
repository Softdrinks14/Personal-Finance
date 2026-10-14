# 💰 Duitku — Personal Finance Tracker

Aplikasi web untuk mencatat dan memantau keuangan pribadi: dashboard analitik, input manual, **dan input otomatis dari screenshot mutasi bank lewat OCR**.

Dibuat untuk pemula: semua penjelasan pakai bahasa Indonesia, dan aplikasi **langsung bisa jalan tanpa konfigurasi apa pun** (mode LocalStorage), lalu bisa ditingkatkan ke database cloud Supabase kapan saja.

---

## ✨ Fitur

### 1. Dashboard & Analitik Visual (`/`)
- Tiga kartu ringkasan: **Total Pemasukan**, **Total Pengeluaran**, **Saldo Bersih** bulan ini — lengkap dengan perbandingan persen vs bulan lalu.
- **Grafik batang**: pemasukan vs pengeluaran 6 bulan terakhir.
- **Diagram donat**: pembagian per kategori (bisa diganti antara "Keluar" dan "Masuk").
- Tabel **5 transaksi terakhir**.
- **Form tambah cepat** di sisi kanan.
- Tombol **"Isi data contoh"** untuk mengisi 6 bulan data dummy supaya grafik langsung terlihat.

### 2. Input Manual (`/` dan `/transactions`)
- Form dengan jenis (Pemasukan/Pengeluaran), nominal, tanggal, kategori, dan catatan.
- **Format rupiah otomatis**: ketik `1500000` → langsung jadi `1.500.000`.
- Validasi input (nominal wajib > 0, tanggal wajib diisi, batas maksimal nominal).

### 3. Input Otomatis via Screenshot Bank / OCR (`/upload`)
- **Drag & drop** screenshot (bisa beberapa file sekaligus, PNG/JPG/WEBP, maks. 10 MB).
- **Tesseract.js** membaca teks **langsung di browser** — gratis, tanpa API key, gambar tidak dikirim ke server mana pun.
- **Parser pintar** yang mengenali:
  - Nominal: `Rp 150.000`, `150.000,00`, `1.500.000`, `150,000`, `150000.00`, `-45.000`, bahkan `1 350 000` (spasi akibat salah baca OCR).
  - Tanggal: `01/10/2026`, `2026-10-14`, `14-10-26`, `14.10.2026`, `07 Okt 2026`, `14/10`.
  - Jenis transaksi: penanda bank **DB/Debet** = uang keluar, **CR/Kredit** = uang masuk.
  - Baris saldo/total/header rekening otomatis **dilewati** (tidak ikut tercatat).
  - Kalau bank hanya menulis tanggal sekali di atas, tanggal itu dipakai untuk baris-baris di bawahnya.
- **Tabel review**: setiap kolom bisa diedit, ada indikator keyakinan (Tinggi/Sedang/Rendah) dan baris teks asli OCR sebagai pembanding. **Tidak ada yang otomatis tersimpan** — kamu yang memutuskan.
- Kategori ditebak otomatis dari kata kunci (mis. "GRABFOOD" → Makanan & Minuman, "TOKEN LISTRIK" → Tagihan & Utilitas).

### 4. Riwayat & Laporan (`/transactions`)
- Tabel lengkap dengan **pencarian** (keterangan, kategori, nominal, tanggal, sumber).
- **Filter** jenis, bulan, dan kategori — plus kartu total dari hasil filter.
- **Edit** dan **hapus** (dengan dialog konfirmasi).
- **Export CSV** — siap dibuka di Excel/Google Sheets (sudah pakai BOM + baris total).

### 5. Lain-lain
- 🌙 **Mode gelap / terang** (tersimpan di localStorage, tanpa kedipan saat reload).
- 📱 **Responsif** — tabel bisa di-scroll horizontal di HP.
- 🔔 **Notifikasi toast** untuk setiap aksi.
- 🏷️ Badge status di navbar: **Supabase** (cloud) atau **Local** (browser).

---

## 🛠️ Teknologi

| Bagian | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 | Satu proyek untuk tampilan + API, siap deploy ke Vercel |
| Styling | **Tailwind CSS 3** + komponen UI sendiri (gaya shadcn/ui) | Cepat, konsisten, mudah diubah |
| Ikon | **lucide-react** | Ringan & rapi |
| Grafik | **Recharts 2** | Komponen React, deklaratif, mudah dibaca |
| Database | **Supabase** (PostgreSQL) + fallback **LocalStorage** | Gratis, tanpa server sendiri |
| OCR | **Tesseract.js 5** (bahasa `ind+eng`) | Gratis, jalan di browser, tanpa API key |

---

## 📋 Persiapan

Cukup satu hal: **Node.js versi 20 atau lebih baru**.

```bash
node -v      # contoh keluaran: v26.7.0
```

Kalau belum ada, unduh di <https://nodejs.org> (pilih versi LTS).

> Diuji dengan Node v26.7.0, npm 11.19.0, Next.js 16.4.0.

---

## 🚀 Langkah 1 — Menjalankan Aplikasi (Mode LocalStorage)

Cara tercepat mencoba. **Belum perlu Supabase, belum perlu daftar apa pun.**

```bash
# 1. Masuk ke folder proyek
cd personal-finance-tracker

# 2. Install semua library (sekali saja, ±2 menit)
npm install

# 3. Jalankan server pengembangan
npm run dev
```

Buka <http://localhost:3000> di browser.

Kamu akan melihat badge **"Local"** di kanan atas. Artinya data disimpan di **localStorage browser** — seperti buku catatan yang disimpan di dalam browser itu sendiri. Praktis untuk mencoba, tapi:

- ❌ Tidak bisa dibuka dari HP atau komputer lain.
- ❌ Bisa hilang kalau data browser dibersihkan.

Untuk data permanen, lanjut ke **Langkah 3 (Supabase)**.

> 💡 **Pertama kali mencoba?** Buka dashboard, klik tombol **"Isi data contoh"**. Grafik dan tabel akan langsung terisi 6 bulan data supaya kamu bisa melihat semua fiturnya. Hapus kapan saja lewat tombol "Reset semua data".

---

## 📁 Struktur Proyek

```
personal-finance-tracker/
│
├── app/                          # Semua halaman & API (Next.js App Router)
│   ├── layout.tsx                # Kerangka HTML, metadata, skrip anti-kedip tema gelap
│   ├── providers.tsx             # Membungkus app dengan ToastProvider + DataProvider
│   ├── globals.css               # Design token (warna, radius) + Tailwind
│   ├── page.tsx                  # 🏠 Dashboard: kartu ringkasan, 2 grafik, tabel terakhir, form cepat
│   ├── transactions/
│   │   └── page.tsx              # 📋 Riwayat: cari, filter, edit, hapus, export CSV
│   ├── upload/
│   │   └── page.tsx              # 📷 Scan OCR: upload → review → simpan
│   └── api/                      # API Route Handlers (serverless)
│       ├── transactions/route.ts         # GET (daftar) & POST (tambah)
│       ├── transactions/[id]/route.ts    # PATCH (ubah) & DELETE (hapus)
│       └── categories/route.ts           # GET & POST kategori
│
├── components/
│   ├── data-provider.tsx         # Context: ambil data sekali, bagikan ke semua halaman
│   ├── data-mode-banner.tsx      # Peringatan saat masih memakai LocalStorage
│   ├── summary-cards.tsx         # 3 kartu ringkasan + tren persen
│   ├── transaction-form.tsx      # Form tambah/edit transaksi
│   ├── transaction-table.tsx     # Tabel transaksi + dialog konfirmasi hapus
│   ├── upload-zone.tsx           # Drag & drop + progres OCR
│   ├── ocr-review-table.tsx      # Tabel koreksi hasil OCR
│   ├── charts/
│   │   ├── monthly-bar-chart.tsx    # Grafik batang 6 bulan
│   │   └── category-donut-chart.tsx # Diagram donat per kategori
│   ├── layout/
│   │   ├── app-shell.tsx         # Navbar + konten + footer
│   │   ├── navbar.tsx            # Menu & badge mode penyimpanan
│   │   └── theme-toggle.tsx      # Tombol mode gelap/terang
│   └── ui/                       # Komponen dasar: button, card, input, dialog, table, badge, toast
│
├── lib/
│   ├── types.ts                  # Tipe data global (Transaction, Category, dst)
│   ├── supabase.ts               # Koneksi Supabase + deteksi apakah sudah dikonfigurasi
│   ├── storage.ts                # 🧠 Lapisan data: Supabase ATAU LocalStorage (satu pintu)
│   ├── ocr.ts                    # Mesin OCR + parser mutasi bank
│   ├── analytics.ts              # Perhitungan grafik & ringkasan bulan
│   ├── csv.ts                    # Export CSV
│   └── utils.ts                  # Format rupiah, tanggal, helper umum
│
├── supabase/
│   └── schema.sql                # Skema tabel + RLS + kategori bawaan + view
│
├── .env.local.example            # Contoh isi kredensial Supabase
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

**Prinsip penting:** semua halaman memanggil `lib/storage.ts`, bukan Supabase langsung. Jadi logika aplikasi tidak perlu tahu data disimpan di mana — kalau kredensial Supabase kosong, otomatis pakai LocalStorage.

---

## 🗄️ Langkah 2 — Membuat Database Supabase

> **Analogi:** Supabase itu seperti "gudang" di internet. LocalStorage cuma kotak sepatu di kamarmu — muat sedikit dan cuma ada di satu tempat. Gudang bisa diakses dari mana saja.

### 2.1 Buat project

1. Buka <https://supabase.com> → **Start your project** → daftar (bisa pakai akun GitHub).
2. Klik **New project**.
3. Isi:
   - **Name**: `duitku` (bebas)
   - **Database Password**: buat password kuat, **simpan** (jarang dipakai, tapi jangan hilang)
   - **Region**: pilih **Southeast Asia (Singapore)** supaya cepat diakses dari Indonesia
4. Klik **Create new project** dan tunggu ±2 menit sampai selesai menyiapkan database.

### 2.2 Jalankan skema database

1. Di panel kiri Supabase, klik **SQL Editor**.
2. Klik **New query**.
3. Buka file `supabase/schema.sql` dari proyek ini, **salin seluruh isinya**, tempel ke editor.
4. Klik **Run** (atau `Ctrl + Enter`).

Kalau berhasil, kamu akan melihat pesan *Success*. Buka menu **Table Editor** di kiri — akan ada dua tabel baru:

- **`categories`** — sudah terisi 12 kategori bawaan (Makanan, Transportasi, Gaji, dst).
- **`transactions`** — masih kosong, siap diisi.

> Skema ini aman dijalankan berulang kali (memakai `if not exists` dan `on conflict do nothing`).

### 2.3 Ambil kredensial

1. Panel kiri → **Project Settings** (ikon gerigi) → **API**.
2. Salin dua nilai berikut:
   - **Project URL** — bentuknya `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — teks panjang diawali `eyJ...`

> ⚠️ **Hati-hati, ini penyebab error yang paling sering.** Di halaman itu ada beberapa URL yang mirip-mirip. Yang kamu butuhkan **hanya `Project URL`** — bentuknya berhenti di `.supabase.co` saja.
>
> ❌ Jangan pakai yang ada tambahan di belakangnya:
> - `https://xxxxxxxxxxxx.supabase.co/rest/v1/` ← ini **REST URL**, bukan Project URL
> - `https://xxxxxxxxxxxx.supabase.co/auth/v1`
>
> Kalau salah, transaksi akan gagal tersimpan dengan pesan *"Invalid path specified in request URL"*.

> ⚠️ Jangan pakai **`service_role` key**. Kunci itu punya akses penuh dan tidak boleh dipakai di browser.

### 2.4 Isi file `.env.local`

1. Di folder proyek, **salin** file `.env.local.example` menjadi `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

   (Di Windows bisa juga: klik kanan → Copy, lalu Paste, dan ganti namanya.)

2. Buka `.env.local` dengan editor teks, isi seperti ini:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9......panjang.....
   ```

3. **Hentikan** server (`Ctrl + C` di terminal) lalu jalankan lagi:

   ```bash
   npm run dev
   ```

> 🔁 **Penting:** variabel `NEXT_PUBLIC_*` ditanam saat aplikasi di-build. Kalau tidak restart, perubahan `.env.local` tidak terbaca.

### 2.5 Pastikan sudah tersambung

Buka <http://localhost:3000>. Badge di navbar sekarang harus berubah dari **"Local"** menjadi **"Supabase"**, dan banner kuning peringatan LocalStorage hilang.

Coba tambah satu transaksi, lalu buka **Supabase → Table Editor → transactions**. Barisnya harus muncul di sana. ✅

---

## ☁️ Langkah 3 — Deploy ke Vercel (Gratis)

### 3.1 Kirim kode ke GitHub

```bash
# di folder proyek
git init
git add .
git commit -m "Personal finance tracker"

# buat repository kosong dulu di https://github.com/new, lalu:
git remote add origin https://github.com/USERNAME/personal-finance-tracker.git
git branch -M main
git push -u origin main
```

> File `.env.local` **tidak** ikut terkirim (sudah ada di `.gitignore`). Itu memang yang kita mau — kunci rahasia jangan masuk GitHub.

### 3.2 Import ke Vercel

1. Buka <https://vercel.com> → daftar pakai akun GitHub.
2. Klik **Add New… → Project**.
3. Pilih repository `personal-finance-tracker` → **Import**.
4. Vercel akan mendeteksi Next.js otomatis. **Jangan ubah apa pun** di bagian Build & Output Settings.
5. Buka bagian **Environment Variables**, tambahkan dua variabel (sama seperti isi `.env.local`):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |

6. Klik **Deploy** dan tunggu ±1–2 menit.

Selesai! Kamu akan dapat alamat seperti `https://personal-finance-tracker-abc123.vercel.app` yang bisa dibuka dari HP mana pun. 🎉

Setiap kali kamu `git push` ke branch `main`, Vercel otomatis mendeploy ulang.

---

## 🔍 Cara Kerja Fitur OCR

```
 Screenshot          Tesseract.js            Parser               Layar review
┌──────────┐      ┌───────────────┐    ┌──────────────┐     ┌────────────────┐
│  mutasi  │ ───▶ │  teks mentah  │ ─▶ │ tanggal      │ ──▶ │ tabel bisa     │ ──▶ Simpan
│  bank    │      │  "01/10 ..."  │    │ nominal      │     │ diedit user    │
└──────────┘      └───────────────┘    │ jenis        │     └────────────────┘
   (browser)        (browser)          │ keterangan   │
                                       └──────────────┘
```

Semua tahap berjalan **di browser user**. Tidak ada gambar yang diunggah ke server.

### Aturan yang dipakai parser

| Situasi di mutasi bank | Yang dilakukan parser |
|---|---|
| `150.000` / `1.500.000` | Dibaca sebagai 150.000 / 1.500.000 (pemisah ribuan) |
| `150.000,00` / `150,000.00` | Angka di belakang koma/titik = sen, dibulatkan ke rupiah |
| `Rp150.000` (tanpa spasi) | Tetap dikenali |
| Baris ada `DB` / `DEBET` | Uang **keluar** |
| Baris ada `CR` / `KREDIT` | Uang **masuk** |
| `PEMBAYARAN KARTU KREDIT` | Uang **keluar** (pengecualian khusus, karena ada kata "kredit") |
| Nominal diawali `-` | Uang **keluar** |
| Baris berisi `SALDO` / `TOTAL` | **Dilewati** — itu saldo, bukan transaksi |
| Baris berisi `No. Rekening`, `Periode`, `Halaman` | **Dilewati** |
| Ada nomor rekening + nominal di satu baris | Nomor rekening **tidak** dianggap nominal |
| Bank hanya menulis tanggal di baris atas | Tanggal itu dipakai untuk baris berikutnya |

### Tips supaya akurasi tinggi

1. Pakai **screenshot asli** dari aplikasi m-banking, bukan foto layar pakai kamera (miring + bayangan).
2. Pastikan tulisan nominal **tidak terpotong**.
3. Pilih tampilan mutasi yang menampilkan **tanggal + keterangan + nominal dalam satu baris**.
4. Kalau hasilnya kurang pas, coba perbesar gambar dulu.
5. **Selalu periksa tabel review sebelum menyimpan** — OCR itu alat bantu, bukan mesin yang selalu benar. Kolom yang meragukan ditandai badge "Rendah"/"Sedang".

> Saat pertama kali dipakai, aplikasi mengunduh data bahasa OCR (±10 MB) dari CDN dan menyimpannya di cache browser. Proses berikutnya jauh lebih cepat.

---

## 🔌 API Endpoint (opsional)

Halaman-halaman aplikasi memakai `lib/storage.ts` langsung, jadi API ini tidak wajib. Tapi tersedia kalau kamu mau menghubungkannya ke script otomasi, Google Sheets, atau bot Telegram.

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/transactions` | Daftar transaksi. Query opsional: `?month=2026-10&type=expense` |
| `POST` | `/api/transactions` | Tambah transaksi |
| `PATCH` | `/api/transactions/{id}` | Ubah sebagian field |
| `DELETE` | `/api/transactions/{id}` | Hapus transaksi |
| `GET` | `/api/categories` | Daftar kategori |
| `POST` | `/api/categories` | Tambah kategori |

Contoh:

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":25000,"date":"2026-10-14","note":"Kopi"}'
```

> Endpoint ini memerlukan Supabase. Kalau belum dikonfigurasi, akan membalas `503` beserta petunjuk.

---

## 🧰 Perintah yang Tersedia

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan server pengembangan di <http://localhost:3000> |
| `npm run build` | Build versi produksi |
| `npm start` | Jalankan hasil build produksi |
| `npm run typecheck` | Periksa tipe TypeScript tanpa build |

---

## 🆘 Troubleshooting

**Badge masih "Local" padahal `.env.local` sudah diisi**
Restart server (`Ctrl + C`, lalu `npm run dev`). Variabel `NEXT_PUBLIC_*` hanya dibaca saat aplikasi di-build/dijalankan.

**`Gagal memuat kategori: relation "public.categories" does not exist`**
Skema database belum dijalankan. Ulangi **Langkah 2.2** di SQL Editor.

**`Gagal menyimpan transaksi: Invalid path specified in request URL`**
`NEXT_PUBLIC_SUPABASE_URL` di `.env.local` berisi **path tambahan** — biasanya `/rest/v1/`. Itu terjadi kalau yang kamu salin dari dashboard Supabase adalah **REST URL**, bukan **Project URL**.

```env
❌ NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co/rest/v1/
✅ NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
```

Hapus bagian `/rest/v1/`-nya, simpan, lalu **restart** `npm run dev`.
Versi terbaru aplikasi ini sudah otomatis membersihkan URL seperti itu, jadi kalau masih error berarti file `.env.local` belum tersimpan atau server belum di-restart.

**`new row violates row-level security policy`**
Bagian RLS di `supabase/schema.sql` belum ikut dijalankan. Jalankan ulang seluruh isi file itu.

**`Gagal menyimpan transaksi: invalid input syntax for type uuid`**
Kamu punya data lama dari mode LocalStorage yang id kategorinya bukan UUID. Aplikasi sudah menangani ini otomatis dengan mencari kategori berdasarkan nama — kalau masih error, tekan **"Reset semua data"** di dashboard lalu mulai lagi.

**OCR lambat atau macet di "Mengunduh data bahasa"**
Unduhan ±10 MB dari CDN. Butuh koneksi internet pada pemakaian pertama. Setelah itu tersimpan di cache.

**OCR menghasilkan 0 transaksi**
Gambarnya kemungkinan kurang jelas atau formatnya tidak biasa. Buka bagian **"Teks Mentah Hasil OCR"** di halaman upload untuk melihat apa yang terbaca mesin — kalau teksnya berantakan, coba screenshot yang lebih besar/jelas. Kalau teksnya bagus tapi tetap 0 hasil, input manual saja (fitur parser bisa disesuaikan di `lib/ocr.ts`).

**Grafik tidak muncul**
Pastikan JavaScript aktif dan tidak ada ekstensi browser yang memblokir. Grafik butuh container dengan tinggi — sudah diatur di komponennya.

**Port 3000 sudah dipakai**
Di komputer ini port 3000 sedang dipakai **Grafana** (`grafana.exe`, PID 8284). Next.js akan otomatis pindah ke port berikutnya dan menampilkan alamat aslinya di terminal, misalnya:

```
- Local:  http://localhost:3001
```

Buka alamat yang tertulis itu (bukan 3000). Kalau ingin memaksa port tertentu:

```bash
npm run dev -- -p 3001
```

---

## 🧠 Keputusan Desain (kenapa begini?)

- **`amount` selalu positif, arah uang ditentukan `type`.** Lebih mudah divalidasi, dijumlahkan, dan tidak ada bug tanda minus yang tidak sengaja.
- **Tanggal disimpan sebagai `yyyy-MM-dd`.** Aman untuk sorting dan filter, tidak terpengaruh zona waktu.
- **Satu lapisan data (`lib/storage.ts`).** Halaman tidak tahu-menahu soal Supabase vs LocalStorage, jadi menambah sumber data baru (mis. PocketBase) cukup mengubah satu file.
- **OCR tidak pernah menyimpan otomatis.** Hasil mesin selalu lewat tabel review dulu — angka keuangan terlalu penting untuk dipercayakan penuh ke OCR.
- **Kategori ditebak lewat nama, bukan id.** Id kategori berbeda antara Supabase (UUID) dan LocalStorage (`cat-makanan`), jadi nama adalah jembatan yang paling aman.
- **DataProvider sebagai satu sumber kebenaran.** Data diambil sekali, lalu dibagikan ke semua halaman — tidak ada fetch berulang saat berpindah menu.
- **Tidak memakai library tanggal.** Format dan parsing tanggal Indonesia cukup ditulis sendiri di `lib/utils.ts`, menghemat ukuran bundle.

---

## ⚠️ Catatan Keamanan

Aplikasi ini **belum memakai fitur login**. Kebijakan RLS di `supabase/schema.sql` sengaja mengizinkan akses penuh dengan anon key supaya langsung bisa dipakai. Artinya: siapa pun yang tahu URL + anon key project-mu bisa melihat dan mengubah datamu.

Untuk pemakaian pribadi ini umumnya cukup. Kalau nanti mau dipakai banyak orang, tambahkan **Supabase Auth** dan ubah kebijakan menjadi `auth.uid() = user_id` (petunjuknya sudah ditulis sebagai komentar di `supabase/schema.sql`).

---

Dibuat dengan ❤️ untuk belajar sekaligus dipakai sehari-hari.
