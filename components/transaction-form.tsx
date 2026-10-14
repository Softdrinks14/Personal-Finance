'use client';

import * as React from 'react';
import { Loader2, Save, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import type { Category, Transaction, TransactionInput, TxType } from '@/lib/types';
import { cn, formatThousands, parseAmountInput, todayISO } from '@/lib/utils';

/**
 * Form input transaksi (dipakai untuk "tambah baru" maupun "edit").
 *
 * Yang perlu diperhatikan:
 * - Nominal diformat otomatis jadi gaya Indonesia saat user mengetik.
 * - Daftar kategori menyesuaikan jenis transaksi (Pemasukan/Pengeluaran).
 */

export interface TransactionFormProps {
  categories: Category[];
  /** Kalau diisi, form berubah jadi mode edit. */
  initial?: Transaction | null;
  onSubmit: (input: TransactionInput) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

export function TransactionForm({
  categories,
  initial = null,
  onSubmit,
  onCancel,
  submitLabel,
  className,
}: TransactionFormProps) {
  const [type, setType] = React.useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [categoryId, setCategoryId] = React.useState('');
  const [note, setNote] = React.useState('');
  const [errors, setErrors] = React.useState<{ amount?: string; date?: string }>({});
  const [saving, setSaving] = React.useState(false);

  /** Sinkronkan isi form setiap kali transaksi yang diedit berubah. */
  React.useEffect(() => {
    setType(initial?.type ?? 'expense');
    setAmount(initial ? formatThousands(String(initial.amount)) : '');
    setDate(initial?.date ?? todayISO());
    setCategoryId(initial?.category_id ?? '');
    setNote(initial?.note ?? '');
    setErrors({});
  }, [initial]);

  /** Kategori yang relevan dengan jenis transaksi yang dipilih. */
  const options = React.useMemo(
    () => categories.filter((category) => category.type === type || category.type === 'both'),
    [categories, type],
  );

  /** Kalau kategori terpilih tidak cocok lagi setelah ganti jenis, kosongkan. */
  React.useEffect(() => {
    if (categoryId && !options.some((category) => category.id === categoryId)) {
      setCategoryId('');
    }
  }, [categoryId, options]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const numericAmount = parseAmountInput(amount);
    const nextErrors: { amount?: string; date?: string } = {};

    if (!numericAmount || numericAmount <= 0) {
      nextErrors.amount = 'Nominal wajib diisi dan harus lebih dari 0.';
    }
    if (numericAmount > 999_999_999_999) {
      nextErrors.amount = 'Nominal terlalu besar. Cek kembali angka yang kamu masukkan.';
    }
    if (!date) {
      nextErrors.date = 'Tanggal wajib diisi.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit({
        type,
        amount: numericAmount,
        date,
        category_id: categoryId || null,
        note: note.trim() || null,
        source: initial?.source ?? 'manual',
      });

      if (!initial) {
        // Setelah menambah, kosongkan nominal & keterangan supaya bisa input cepat
        // beruntun. Tanggal & jenis dibiarkan agar tidak perlu diisi ulang.
        setAmount('');
        setNote('');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-4', className)}>
      {/* Pilih jenis transaksi */}
      <div className="grid grid-cols-2 gap-2">
        {(['expense', 'income'] as TxType[]).map((option) => {
          const isActive = type === option;
          const Icon = option === 'expense' ? TrendingDown : TrendingUp;
          const label = option === 'expense' ? 'Pengeluaran' : 'Pemasukan';
          return (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={isActive}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
                isActive && option === 'expense' && 'border-destructive/40 bg-destructive/10 text-destructive',
                isActive && option === 'income' && 'border-success/40 bg-success/10 text-success',
                !isActive && 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Nominal */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-amount">Nominal (Rupiah)</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            Rp
          </span>
          <Input
            id="tx-amount"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(formatThousands(event.target.value))}
            className="tabular pl-10 text-base font-medium"
            aria-invalid={Boolean(errors.amount)}
          />
        </div>
        {errors.amount ? (
          <FieldError>{errors.amount}</FieldError>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ketik angkanya saja, titik ribuan ditambahkan otomatis.
          </p>
        )}
      </div>

      {/* Tanggal & Kategori */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-date">Tanggal</Label>
          <Input
            id="tx-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={Boolean(errors.date)}
          />
          <FieldError>{errors.date}</FieldError>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-category">Kategori</Label>
          <Select
            id="tx-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">— Tanpa kategori —</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Keterangan */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-note">Catatan / Keterangan</Label>
        <Textarea
          id="tx-note"
          placeholder="Contoh: Makan siang bareng tim, bayar listrik bulan Oktober..."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
        />
        <p className="text-right text-xs text-muted-foreground">{note.length}/200</p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitLabel ?? (initial ? 'Simpan Perubahan' : 'Simpan Transaksi')}
        </Button>
      </div>
    </form>
  );
}
