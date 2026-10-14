'use client';

import * as React from 'react';
import { CheckCheck, Loader2, Save, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { summarizeParsed } from '@/lib/ocr';
import type { Category, ParsedTransaction, TransactionInput, TxType } from '@/lib/types';
import { cn, formatIDR, formatNumber, parseAmountInput } from '@/lib/utils';

/**
 * Tabel review hasil OCR.
 *
 * Ini bagian PENTING dari alur OCR: hasil mesin TIDAK langsung disimpan.
 * User bisa mengoreksi tanggal, jenis, nominal, kategori, dan keterangan
 * sebelum menekan "Simpan".
 */

export interface OcrReviewTableProps {
  items: ParsedTransaction[];
  onChange: (items: ParsedTransaction[]) => void;
  categories: Category[];
  onSave: (inputs: TransactionInput[]) => Promise<void> | void;
  onDiscard: () => void;
  saving?: boolean;
}

function confidenceTone(confidence: number): { tone: 'income' | 'warning' | 'neutral'; label: string } {
  if (confidence >= 0.8) return { tone: 'income', label: 'Tinggi' };
  if (confidence >= 0.5) return { tone: 'warning', label: 'Sedang' };
  return { tone: 'neutral', label: 'Rendah' };
}

export function OcrReviewTable({
  items,
  onChange,
  categories,
  onSave,
  onDiscard,
  saving = false,
}: OcrReviewTableProps) {
  // Teks nominal per baris disimpan terpisah supaya user bisa mengetik dengan
  // nyaman (titik ribuan baru muncul setelah keluar dari kolom).
  const [amountText, setAmountText] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, formatNumber(item.amount)])),
  );

  React.useEffect(() => {
    setAmountText((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of items) {
        if (!(item.id in next)) {
          next[item.id] = formatNumber(item.amount);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const update = (id: string, patch: Partial<ParsedTransaction>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const selectedItems = items.filter((item) => item.selected);
  const summary = summarizeParsed(items);
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const handleSave = async () => {
    const inputs: TransactionInput[] = selectedItems
      .filter((item) => item.amount > 0)
      .map((item) => ({
        type: item.type,
        amount: item.amount,
        date: item.date,
        category_id: item.category_id,
        note: item.description || null,
        source: 'ocr' as const,
      }));

    if (inputs.length > 0) await onSave(inputs);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ringkasan atas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <CheckCheck className="h-4 w-4 text-primary" />
            {summary.selected} dari {items.length} baris dipilih
          </span>
          <span className="tabular text-success">Masuk: {formatIDR(summary.income)}</span>
          <span className="tabular text-destructive">Keluar: {formatIDR(summary.expense)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(items.map((item) => ({ ...item, selected: !allSelected })))}
          >
            {allSelected ? 'Kosongkan pilihan' : 'Pilih semua'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
            <X className="h-3.5 w-3.5" /> Buang hasil
          </Button>
        </div>
      </div>

      {/* Tabel review */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <input
                  type="checkbox"
                  aria-label="Pilih semua baris"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={allSelected}
                  onChange={(event) =>
                    onChange(items.map((item) => ({ ...item, selected: event.target.checked })))
                  }
                />
              </TableHead>
              <TableHead className="w-[140px]">Tanggal</TableHead>
              <TableHead className="w-[130px]">Jenis</TableHead>
              <TableHead className="w-[150px] text-right">Nominal</TableHead>
              <TableHead className="w-[180px]">Kategori</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="w-[92px]">Yakin</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((item) => {
              const tone = confidenceTone(item.confidence);
              const options = categories.filter(
                (category) => category.type === item.type || category.type === 'both',
              );

              return (
                <TableRow key={item.id} className={cn(!item.selected && 'opacity-50')}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label="Ikut simpan baris ini"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={item.selected}
                      onChange={(event) => update(item.id, { selected: event.target.checked })}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="date"
                      value={item.date}
                      onChange={(event) => update(item.id, { date: event.target.value })}
                      className="h-9"
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      value={item.type}
                      onChange={(event) =>
                        update(item.id, { type: event.target.value as TxType, category_id: null })
                      }
                      className="h-9"
                    >
                      <option value="expense">Pengeluaran</option>
                      <option value="income">Pemasukan</option>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <Input
                      inputMode="numeric"
                      value={amountText[item.id] ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setAmountText((prev) => ({ ...prev, [item.id]: raw }));
                        update(item.id, { amount: parseAmountInput(raw) });
                      }}
                      onBlur={() =>
                        setAmountText((prev) => ({
                          ...prev,
                          [item.id]: formatNumber(item.amount),
                        }))
                      }
                      className="tabular h-9 text-right font-medium"
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      value={item.category_id ?? ''}
                      onChange={(event) => update(item.id, { category_id: event.target.value || null })}
                      className="h-9"
                    >
                      <option value="">— Tanpa kategori —</option>
                      {options.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </TableCell>

                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={(event) => update(item.id, { description: event.target.value })}
                      className="h-9"
                    />
                    <p
                      className="mt-1 truncate text-[11px] text-muted-foreground"
                      title={item.raw}
                    >
                      Asli: {item.raw}
                    </p>
                  </TableCell>

                  <TableCell>
                    <Badge tone={tone.tone}>
                      {tone.tone === 'neutral' ? (
                        <TriangleAlert className="h-3 w-3" />
                      ) : (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      {tone.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Tombol simpan */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Periksa dulu nominal & jenis transaksinya. Tekan simpan kalau sudah benar.
        </p>
        <Button onClick={handleSave} disabled={saving || summary.selected === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan {summary.selected} transaksi
        </Button>
      </div>
    </div>
  );
}
