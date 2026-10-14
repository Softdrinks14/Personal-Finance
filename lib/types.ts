/**
 * Tipe data global aplikasi.
 *
 * Analogi sederhana:
 * - Category  = "label" / "kotak" tempat kita mengelompokkan uang (Makanan, Gaji, dll)
 * - Transaction = satu baris catatan uang keluar / masuk
 * - ParsedTransaction = hasil sementara dari OCR, belum disimpan ke database
 */

/** Jenis transaksi. */
export type TxType = 'income' | 'expense';

/** Kategori bisa dipakai untuk pemasukan, pengeluaran, atau keduanya. */
export type CategoryType = TxType | 'both';

/** Dari mana transaksi berasal: diketik manual atau hasil scan OCR. */
export type TxSource = 'manual' | 'ocr';

/** Mode penyimpanan yang sedang aktif. */
export type DataMode = 'supabase' | 'local';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  /** Warna HEX untuk grafik, contoh: "#f97316" */
  color: string;
  created_at?: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Nominal dalam Rupiah, selalu angka positif. Arah uang ditentukan oleh `type`. */
  amount: number;
  /** Tanggal format ISO `yyyy-MM-dd` (aman untuk sorting & filter). */
  date: string;
  category_id: string | null;
  note: string | null;
  source: TxSource;
  created_at?: string;
}

/** Bentuk data yang dikirim form ke lapisan penyimpanan (tanpa id/timestamp). */
export type TransactionInput = Omit<Transaction, 'id' | 'created_at'>;

/** Hasil ekstraksi OCR sebelum dikonfirmasi user. */
export interface ParsedTransaction {
  /** id sementara untuk keperluan React key */
  id: string;
  /** dicentang / tidak untuk ikut disimpan */
  selected: boolean;
  type: TxType;
  amount: number;
  date: string;
  description: string;
  category_id: string | null;
  /** 0..1 — seberapa yakin parser terhadap hasil ini */
  confidence: number;
  /** baris teks asli dari OCR (untuk verifikasi manual) */
  raw: string;
}
