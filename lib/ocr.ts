import type { ParsedTransaction, TxType } from './types';
import { formatNumber, todayISO, uid } from './utils';

/* =========================================================================
 * MESIN OCR + PARSER MUTASI BANK
 * -------------------------------------------------------------------------
 * Alur kerjanya:
 *   1. runOcr()                 -> ubah gambar jadi teks mentah (Tesseract.js, gratis, offline di browser)
 *   2. parseTransactionsFromText() -> ubah teks mentah jadi daftar transaksi
 *   3. User mereview & mengoreksi di layar sebelum disimpan
 *
 * Tesseract.js TIDAK butuh API key dan berjalan sepenuhnya di browser user.
 * Saat pertama kali dipakai, file bahasa (~10 MB) diunduh dari CDN.
 * ========================================================================= */

/** Bahasa OCR: Indonesia + Inggris (bank kadang memakai istilah Inggris). */
export const OCR_LANG = 'ind+eng';

export interface OcrProgress {
  status: string;
  /** 0..1 */
  progress: number;
}

/**
 * Jalankan OCR pada sebuah gambar.
 * Import `tesseract.js` dilakukan secara dinamis supaya library berat ini
 * hanya diunduh saat user benar-benar menekan tombol "Mulai Scan".
 */
export async function runOcr(
  file: File | Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const Tesseract = await import('tesseract.js');

  const worker = await Tesseract.createWorker(OCR_LANG, undefined, {
    logger: (message: any) => {
      if (!onProgress) return;
      onProgress({
        status: String(message?.status ?? ''),
        progress: typeof message?.progress === 'number' ? message.progress : 0,
      });
    },
  });

  try {
    const { data } = await worker.recognize(file);
    return data.text ?? '';
  } finally {
    // Selalu matikan worker supaya memori browser tidak menumpuk.
    await worker.terminate();
  }
}

/* =========================================================================
 * BAGIAN 1: PARSER ANGKA RUPIAH
 * ========================================================================= */

/**
 * Ubah teks angka gaya Indonesia menjadi number.
 *
 * Contoh yang benar:
 *   "Rp 150.000"     -> 150000
 *   "150.000,00"     -> 150000
 *   "1.500.000"      -> 1500000
 *   "150,000"        -> 150000   (gaya Inggris)
 *   "150000.00"      -> 150000
 *   "-45.000"        -> -45000   (tanda minus = uang keluar)
 */
export function parseRupiahAmount(raw: string): number | null {
  let text = raw.replace(/\s/g, '');
  text = text.replace(/^(rp|idr)\.?/i, '');
  text = text.replace(/[^0-9.,-]/g, '');
  if (!text) return null;

  const negative = text.trim().startsWith('-');
  text = text.replace(/-/g, '');
  if (!text) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  let intPart = text;
  let decPart = '';

  if (lastDot >= 0 && lastComma >= 0) {
    // Ada dua jenis pemisah -> yang paling belakang adalah pemisah desimal.
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    const [head, ...tail] = text.split(decimalSep);
    intPart = head.split(thousandSep).join('');
    decPart = tail.join('');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = text.split(sep);
    const tail = parts[parts.length - 1];

    if (parts.length >= 2 && tail.length === 3 && parts[0].length <= 3) {
      // "150.000" / "1.500.000" -> pemisah ribuan
      intPart = parts.join('');
    } else if (parts.length === 2 && tail.length <= 2) {
      // "150000.00" -> pemisah desimal
      intPart = parts[0];
      decPart = tail;
    } else {
      intPart = parts.join('');
    }
  }

  const digits = `${intPart || '0'}.${decPart || '0'}`;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;

  return negative ? -value : value;
}

/* =========================================================================
 * BAGIAN 2: PARSER TANGGAL
 * ========================================================================= */

const MONTH_WORDS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktob: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidParts(year: number, month: number, day: number): boolean {
  return (
    year >= 1990 && year <= 2100 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31
  );
}

export interface DateHit {
  iso: string;
  /** teks yang cocok — nanti dibuang sebelum mencari nominal */
  matched: string;
}

/**
 * Cari tanggal di dalam satu baris teks.
 * Mendukung format yang umum di mutasi bank Indonesia:
 *   2026-10-14 | 14/10/2026 | 14-10-26 | 14.10.2026 | 14 Okt 2026 | 14/10
 */
export function findDateInLine(line: string): DateHit | null {
  // 1. Format ISO: 2026-10-14
  const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(line);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (isValidParts(year, month, day)) {
      return { iso: isoFromParts(year, month, day), matched: isoMatch[0] };
    }
  }

  // 2. Format angka: 14/10/2026, 14-10-26, 14.10.2026
  const numericMatch = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/.exec(line);
  if (numericMatch) {
    let year = Number(numericMatch[3]);
    if (year < 100) year += 2000;

    let day = Number(numericMatch[1]);
    let month = Number(numericMatch[2]);

    // Kalau jelas kebalik (bulan > 12), tukar posisinya.
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }

    if (isValidParts(year, month, day)) {
      return { iso: isoFromParts(year, month, day), matched: numericMatch[0] };
    }
  }

  // 3. Format teks: 14 Okt 2026 / 14 October 2026
  const textMatch = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/.exec(line);
  if (textMatch) {
    const month = MONTH_WORDS[textMatch[2].toLowerCase()];
    let year = Number(textMatch[3]);
    if (year < 100) year += 2000;
    const day = Number(textMatch[1]);
    if (month && isValidParts(year, month, day)) {
      return { iso: isoFromParts(year, month, day), matched: textMatch[0] };
    }
  }

  // 4. Format pendek tanpa tahun: 14/10 (dipakai bank pada baris mutasi)
  const shortMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(line);
  if (shortMatch) {
    const day = Number(shortMatch[1]);
    const month = Number(shortMatch[2]);
    const year = new Date().getFullYear();
    if (isValidParts(year, month, day)) {
      return { iso: isoFromParts(year, month, day), matched: shortMatch[0] };
    }
  }

  return null;
}

/* =========================================================================
 * BAGIAN 3: PARSER NOMINAL
 * ========================================================================= */

interface AmountCandidate {
  /** teks asli yang cocok */
  text: string;
  /** nilai rupiah */
  value: number;
  negative: boolean;
  /** ditulis dengan awalan "Rp"/"IDR" */
  hasPrefix: boolean;
  /** memakai pemisah ribuan (150.000 / 150,000) */
  hasGroup: boolean;
  /** jumlah digit tanpa pemisah */
  digitCount: number;
}

const CANDIDATE_RE =
  /(rp\.?|idr)?\s*(-)?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;

/**
 * Ambil semua kandidat nominal dari satu baris.
 * Aturan: sebuah angka dianggap "nominal uang" kalau
 *   - diawali "Rp"/"IDR", ATAU
 *   - memakai pemisah ribuan (150.000 / 150,000), ATAU
 *   - punya minimal 4 digit (misal "150000")
 * Tujuannya supaya jam ("10:30"), nomor referensi pendek, dan tanggal
 * tidak ikut terbaca sebagai nominal.
 */
export function extractAmountCandidates(line: string): AmountCandidate[] {
  const results: AmountCandidate[] = [];
  const text = line.replace(/\s+/g, ' ');
  let match: RegExpExecArray | null;

  CANDIDATE_RE.lastIndex = 0;
  while ((match = CANDIDATE_RE.exec(text)) !== null) {
    const prefix = match[1];
    const sign = match[2];
    const numberText = match[3];
    if (!numberText) continue;

    const hasGroup = /[.,]\d{3}(?!\d)/.test(numberText);
    const digitCount = numberText.replace(/\D/g, '').length;
    const looksLikeMoney = Boolean(prefix) || hasGroup || digitCount >= 4;
    if (!looksLikeMoney) continue;

    const parsed = parseRupiahAmount(`${prefix ?? ''}${numberText}`);
    if (parsed === null) continue;

    const value = Math.abs(parsed);
    if (value < 1 || value > 999_999_999_999) continue;

    results.push({
      text: match[0].trim(),
      value,
      negative: Boolean(sign) || parsed < 0,
      hasPrefix: Boolean(prefix),
      hasGroup,
      digitCount,
    });
  }

  return results;
}

/**
 * Pilih nominal UTAMA dari sebuah baris.
 *
 * Kenapa perlu? Karena baris mutasi sering berisi lebih dari satu angka:
 *   "TRANSFER KE 0987654321 500.000 1.250.000"
 *                   ^ nomor rekening  ^ transaksi  ^ saldo
 *
 * Urutan pilihan:
 *   1. Angka dengan "Rp" atau pemisah ribuan (paling meyakinkan)
 *   2. Angka biasa yang BUKAN nomor rekening (kurang dari 8 digit)
 *   3. Angka pertama apa adanya
 */
export function pickPrimaryAmount(candidates: AmountCandidate[]): AmountCandidate | null {
  if (candidates.length === 0) return null;

  const strong = candidates.filter((c) => c.hasPrefix || c.hasGroup);
  if (strong.length > 0) return strong[0];

  const notAccountNumber = candidates.filter((c) => c.digitCount < 8);
  if (notAccountNumber.length > 0) return notAccountNumber[0];

  return candidates[0];
}

/* =========================================================================
 * BAGIAN 4: TEBAK JENIS TRANSAKSI (MASUK / KELUAR)
 * ========================================================================= */

const INCOME_WORDS =
  /\b(masuk|pemasukan|penerimaan|diterima|refund|cashback|bunga|gaji|salary|payroll|setor|setoran|deposit|incoming|pendapatan|bonus|thr)\b/i;

const EXPENSE_WORDS =
  /\b(keluar|pengeluaran|bayar|pembayaran|belanja|beli|tarik|penarikan|withdraw|withdrawal|payment|purchase|biaya|fee|admin|tagihan|potongan|pajak|angsuran|cicilan|transfer ke|qris|tunai)\b/i;

/**
 * Pengecualian penting: "PEMBAYARAN KARTU KREDIT" mengandung kata "KREDIT",
 * tapi itu uang KELUAR (kita membayar tagihan kartu kredit).
 */
const CREDIT_CARD_GUARD = /\b(kartu\s+kredit|angsuran|cicilan)\b/i;

/**
 * Tentukan apakah baris ini pemasukan atau pengeluaran.
 *
 * Urutan prioritas:
 *   1. Penanda DB / CR dari bank  (paling dipercaya)
 *   2. Tanda minus di depan nominal
 *   3. Kata kunci umum
 *   4. Default: pengeluaran (mutasi rekening paling sering berisi pengeluaran)
 *
 * Catatan bank Indonesia: DB (debit) = uang KELUAR, CR (kredit) = uang MASUK.
 */
export function guessType(line: string, negative: boolean): TxType {
  const hasDebitMarker = /\b(debit|debet|db)\b/i.test(line);
  const hasCreditMarker = /\b(cr|credit|kredit)\b/i.test(line);

  if (CREDIT_CARD_GUARD.test(line)) return 'expense';
  if (hasDebitMarker && !hasCreditMarker) return 'expense';
  if (hasCreditMarker && !hasDebitMarker) return 'income';
  if (negative) return 'expense';
  if (INCOME_WORDS.test(line)) return 'income';
  if (EXPENSE_WORDS.test(line)) return 'expense';
  return 'expense';
}

/* =========================================================================
 * BAGIAN 5: BERSIHKAN DESKRIPSI
 * ========================================================================= */

function cleanDescription(line: string, removeTokens: string[]): string {
  let text = line;
  for (const token of removeTokens) {
    if (!token) continue;
    text = text.split(token).join(' ');
  }

  text = text
    .replace(/\b(rp|idr)\.?\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ') // jam
    .replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des|januari|februari|maret|april|juni|juli|agustus|september|oktober|november|desember)\b\.?\s*\d{0,4}/gi, ' ')
    // Sisa angka panjang (nomor rekening / saldo yang belum ikut terbuang).
    .replace(/\b\d[\d.,]{3,}\b/g, ' ')
    .replace(/[|_=~*•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Buang sisa tanda baca di ujung kalimat.
  return text.replace(/^[-–—:.,;()\s]+/, '').replace(/[-–—:.,;()\s]+$/, '').slice(0, 120);
}

/* =========================================================================
 * BAGIAN 6: PARSER UTAMA
 * ========================================================================= */

/** Baris yang jelas bukan transaksi (saldo, total, judul kolom). */
const SKIP_LINE_RE = /\b(saldo|balance|total|subtotal|grand total)\b/i;

/** Baris identitas rekening / header laporan — bukan transaksi. */
const HEADER_LINE_RE =
  /\b(periode|halaman|page|statement|rekening koran|mutasi rekening|no\.?\s*rek(ening)?|nomor rekening|nama pemilik|cabang|kantor cabang|npwp|swift)\b/i;

/**
 * Pola tanggal untuk DIBUANG dari baris sebelum mencari nominal.
 * Kenapa? Karena "2026" di tanggal bisa disalahartikan sebagai nominal Rp 2.026.
 */
const DATE_STRIP_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g,
  /\b\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4}\b/g,
  /\b\d{1,2}\/\d{1,2}\b/g,
];

/** Buang SEMUA teks tanggal dari satu baris. */
export function stripDateText(line: string): string {
  let output = line;
  for (const pattern of DATE_STRIP_PATTERNS) {
    output = output.replace(pattern, ' ');
  }
  return output;
}

/**
 * OCR kadang membaca "1.350.000" sebagai "1 350 000" (spasi dianggap pemisah ribuan).
 * Ulangi penggantian sampai stabil, karena satu kali lewat belum cukup untuk
 * "1 350 000" (butuh dua putaran).
 */
function normalizeSpacedThousands(line: string): string {
  let current = line;
  let previous = '';
  let guard = 0;

  while (current !== previous && guard < 5) {
    previous = current;
    // (?<!\d) penting: jangan menyambung angka yang sebenarnya bagian dari
    // deretan digit panjang (misal nomor rekening "0987654321 500.000").
    current = current.replace(/(?<!\d)(\d{1,3})\s(\d{3})(?!\d)/g, '$1.$2');
    guard += 1;
  }

  return current;
}

function confidenceScore(parts: {
  hasDate: boolean;
  hasTypeMarker: boolean;
  description: string;
  amount: number;
}): number {
  let score = 0.25; // punya nominal saja sudah bernilai
  if (parts.hasDate) score += 0.3;
  if (parts.hasTypeMarker) score += 0.2;
  if (parts.description.length >= 4) score += 0.2;
  if (parts.amount >= 1000) score += 0.05;
  return Math.round(Math.min(1, score) * 100) / 100;
}

/**
 * Ubah teks mentah hasil OCR menjadi daftar transaksi siap-review.
 *
 * Trik penting: banyak mutasi bank hanya menuliskan tanggal SEKALI di baris
 * atas, lalu baris-baris di bawahnya hanya berisi jam + keterangan + nominal.
 * Karena itu kita "ingat" tanggal terakhir yang ditemukan dan memakainya
 * untuk baris berikutnya.
 */
export function parseTransactionsFromText(
  rawText: string,
  options?: { defaultDate?: string },
): ParsedTransaction[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, ' ').trim())
    .filter((line) => line.length > 0);

  const results: ParsedTransaction[] = [];
  const seen = new Set<string>();
  let lastDate: string | null = options?.defaultDate ?? null;

  for (const originalLine of lines) {
    const dateHit = findDateInLine(originalLine);
    if (dateHit) lastDate = dateHit.iso;

    // Baris saldo / total / identitas rekening: lewati.
    if (SKIP_LINE_RE.test(originalLine) || HEADER_LINE_RE.test(originalLine)) continue;

    // Buang semua teks tanggal dulu supaya tahun (2026) tidak dibaca sebagai nominal.
    let workingLine = stripDateText(originalLine);
    if (!/\d/.test(workingLine)) continue;

    workingLine = normalizeSpacedThousands(workingLine);

    const candidates = extractAmountCandidates(workingLine);
    if (candidates.length === 0) continue;

    // Nominal utama = angka transaksi; angka lain di baris itu biasanya saldo.
    const primary = pickPrimaryAmount(candidates);
    if (!primary) continue;

    const type = guessType(originalLine, primary.negative);
    // Deskripsi dibersihkan dari `workingLine` (yang tanggalnya sudah dibuang dan
    // pemisah ribuan spasinya sudah dirapikan), supaya angka saldo ikut hilang.
    const description = cleanDescription(workingLine, candidates.map((c) => c.text));
    const date = dateHit?.iso ?? lastDate ?? todayISO();

    const dedupeKey = `${date}|${primary.value}|${type}|${description.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      id: uid(),
      selected: true,
      type,
      amount: primary.value,
      date,
      description: description || 'Transaksi tanpa keterangan',
      category_id: null,
      confidence: confidenceScore({
        hasDate: Boolean(dateHit),
        hasTypeMarker: /\b(db|cr|debit|debet|kredit|credit)\b/i.test(originalLine),
        description,
        amount: primary.value,
      }),
      raw: originalLine,
    });
  }

  return results;
}

/* =========================================================================
 * BAGIAN 7: TEBAK KATEGORI DARI DESKRIPSI
 * ========================================================================= */

const CATEGORY_KEYWORDS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'Makanan & Minuman',
    pattern:
      /\b(makan|makanan|food|resto|restoran|restaurant|warung|kaki lima|kopi|coffee|cafe|kafe|kfc|mcd|mcdonald|burger|pizza|bakso|sate|nasi|gofood|grabfood|shopeefood|starbucks|indomaret|alfamart|supermarket|minimarket|resto)\b/i,
  },
  {
    name: 'Transportasi',
    pattern:
      /\b(transport|transportasi|gojek|grab|ojek|taxi|taksi|bensin|pertamina|shell|vivo|tol|parkir|parking|krl|mrt|lrt|transjakarta|bus|kereta|tiket|travel|flazz|e-?toll|bahan bakar)\b/i,
  },
  {
    name: 'Tagihan & Utilitas',
    pattern:
      /\b(listrik|pln|token listrik|air|pdam|internet|indihome|telkom|telkomsel|xl|tri|smartfren|indosat|byu|pulsa|kuota|paket data|bpjs|pajak|tagihan|iuran|wifi|first media|myrepublic|langganan)\b/i,
  },
  {
    name: 'Belanja',
    pattern:
      /\b(belanja|shopee|tokopedia|lazada|blibli|tiktok ?shop|zalora|uniqlo|h&m|mall|store|toko|ace hardware|ikea|informa)\b/i,
  },
  {
    name: 'Hiburan',
    pattern:
      /\b(hiburan|netflix|spotify|youtube|disney|viu|vidio|game|steam|bioskop|cgv|xxi|cinema|karaoke|traveloka|xendit|tiket\.com)\b/i,
  },
  {
    name: 'Kesehatan',
    pattern:
      /\b(kesehatan|apotek|apotik|kimia farma|guardian|watsons|dokter|rumah sakit|klinik|obat|halodoc|alodokter|lab|vaksin)\b/i,
  },
  {
    name: 'Pendidikan',
    pattern:
      /\b(pendidikan|sekolah|kuliah|kampus|buku|kursus|udemy|coursera|spp|ukt|seminar|workshop)\b/i,
  },
  { name: 'Gaji', pattern: /\b(gaji|salary|payroll|gajian|upah)\b/i },
  { name: 'Bonus & THR', pattern: /\b(bonus|thr|insentif|komisi)\b/i },
  { name: 'Usaha / Freelance', pattern: /\b(usaha|bisnis|freelance|proyek|project|klien|invoice|jualan)\b/i },
  { name: 'Investasi', pattern: /\b(investasi|reksadana|saham|deposito|emas|bibit|ajaib|sukuk|obligasi)\b/i },
];

/**
 * Tebak nama kategori dari deskripsi hasil OCR.
 * Mengembalikan NAMA (bukan id), karena id berbeda antara Supabase (UUID)
 * dan LocalStorage ("cat-makanan").
 */
export function guessCategoryName(description: string, type: TxType): string | null {
  const incomeOnly = ['Gaji', 'Bonus & THR', 'Usaha / Freelance'];
  const expenseOnly = CATEGORY_KEYWORDS.map((c) => c.name).filter((n) => !incomeOnly.includes(n));

  const allowed = type === 'income' ? incomeOnly : expenseOnly;

  for (const { name, pattern } of CATEGORY_KEYWORDS) {
    if (!allowed.includes(name)) continue;
    if (pattern.test(description)) return name;
  }

  return type === 'income' ? 'Gaji' : 'Lain-lain';
}

/** Terjemahkan status teknis Tesseract.js menjadi kalimat bahasa Indonesia. */
export function ocrStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'loading tesseract core': 'Menyiapkan mesin OCR...',
    'initializing tesseract': 'Menginisialisasi mesin OCR...',
    'loading language traineddata': 'Mengunduh data bahasa Indonesia (sekali saja)...',
    'initializing api': 'Menyiapkan pembaca teks...',
    'recognizing text': 'Membaca teks dari gambar...',
  };
  return map[status] ?? (status ? `Memproses: ${status}` : 'Memproses...');
}

/** Hitung total nominal dari hasil OCR yang dicentang (untuk ringkasan). */
export function summarizeParsed(items: ParsedTransaction[]): {
  income: number;
  expense: number;
  selected: number;
} {
  let income = 0;
  let expense = 0;
  let selected = 0;

  for (const item of items) {
    if (!item.selected) continue;
    selected += 1;
    if (item.type === 'income') income += item.amount;
    else expense += item.amount;
  }

  return { income, expense, selected };
}

/** Ubah nominal hasil OCR (number) menjadi teks input yang rapi: 150000 -> "150.000". */
export function amountToInput(value: number): string {
  return formatNumber(Math.round(value));
}
