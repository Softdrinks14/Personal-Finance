'use client';

import * as React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { useData } from '@/components/data-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import type { CarryOverSummary } from '@/lib/analytics';
import { carryOverNoteFor } from '@/lib/analytics';
import { cn, formatIDR, monthLabel } from '@/lib/utils';

/**
 * KARTU "SALDO SISA BULAN LALU" DI DASHBOARD
 * -------------------------------------------------------------------------
 * Menampilkan tiga angka yang saling bersambung:
 *
 *     saldo akhir bulan lalu  +  arus bersih bulan ini  =  total saldo
 *
 * Tombol "Catat sebagai pemasukan" membuat SATU transaksi pemasukan
 * (tanggal 1 bulan yang sedang dilihat) dengan keterangan
 * "Saldo sisa bulan lalu (Okt 2026)". Karena keterangannya baku, transaksi
 * itu dikenali oleh lib/analytics.ts dan TIDAK dihitung dua kali.
 *
 * Kalau nanti ada transaksi bulan lalu yang diubah/dihapus, nominal yang
 * sudah tercatat bisa berbeda dari hasil hitung. Kartu ini lalu menampilkan
 * tombol "Sesuaikan" agar catatannya ikut benar.
 */

interface CarryOverCardProps {
  /** "2026-10" */
  period: string;
  /** "Oktober 2026" */
  periodLabel: string;
  summary: CarryOverSummary;
}

function StatBox({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-border/70 bg-muted/30 px-3 py-2.5',
        highlight && 'border-primary/30 bg-primary/5',
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('tabular text-sm font-semibold', value < 0 ? 'text-destructive' : 'text-foreground')}>
        {formatIDR(value)}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function CarryOverCard({ period, periodLabel, summary }: CarryOverCardProps) {
  const { addTransaction, editTransaction, removeTransaction, categories } = useData();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<'record' | 'sync' | 'undo' | null>(null);

  /**
   * Kalau pengguna sudah punya kategori pemasukan bernama mengandung "saldo"
   * (mis. "Saldo Awal"), pakai itu supaya transaksi tidak menumpuk di
   * "Tanpa kategori". Kalau tidak ada, biarkan tanpa kategori.
   */
  const saldoCategoryId = React.useMemo(() => {
    const found = categories.find(
      (category) =>
        (category.type === 'income' || category.type === 'both') && /saldo/i.test(category.name),
    );
    return found?.id ?? null;
  }, [categories]);

  const firstDayOfPeriod = `${period}-01`;
  const hasCarry = Math.round(summary.amount) > 0;
  const isDeficit = summary.amount < 0;
  const previousLabel = summary.previousLabel || monthLabel(summary.previousKey);

  const record = async () => {
    setBusy('record');
    try {
      await addTransaction({
        type: 'income',
        amount: summary.amount,
        date: firstDayOfPeriod,
        category_id: saldoCategoryId,
        note: carryOverNoteFor(periodLabel),
        source: 'manual',
      });
    } catch {
      // Pesan error sudah ditampilkan DataProvider lewat toast.
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    if (!summary.recordedTransaction) return;
    setBusy('sync');
    try {
      await editTransaction(summary.recordedTransaction.id, {
        type: 'income',
        amount: summary.amount,
        date: firstDayOfPeriod,
        category_id: summary.recordedTransaction.category_id ?? saldoCategoryId,
        note: carryOverNoteFor(periodLabel),
      });
    } catch {
      // sudah ditangani provider
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (!summary.recordedTransaction) return;
    if (!window.confirm('Batalkan pencatatan saldo sisa bulan lalu di bulan ini?')) return;
    setBusy('undo');
    try {
      await removeTransaction(summary.recordedTransaction.id);
      toast({ title: 'Pencatatan saldo dibatalkan', tone: 'success' });
    } catch {
      // sudah ditangani provider
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Angka utama */}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" /> Saldo Sisa Bulan Lalu
            </p>
            <p
              className={cn(
                'tabular text-2xl font-semibold tracking-tight',
                isDeficit ? 'text-destructive' : 'text-foreground',
              )}
            >
              {formatIDR(summary.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Sisa uang sampai akhir {previousLabel}
              {summary.sourceCount > 0
                ? `, dihitung dari ${summary.sourceCount} transaksi sebelum ${periodLabel}.`
                : '.'}
            </p>
          </div>

          {/* Status & tombol aksi */}
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {isDeficit ? (
              <Badge tone="warning">
                <TriangleAlert className="h-3 w-3" /> Saldo minus
              </Badge>
            ) : !hasCarry ? (
              <Badge tone="neutral">Belum ada saldo</Badge>
            ) : summary.recorded && summary.needsSync ? (
              <Badge tone="warning">
                <TriangleAlert className="h-3 w-3" /> Perlu disesuaikan
              </Badge>
            ) : summary.recorded ? (
              <Badge tone="income">
                <CheckCircle2 className="h-3 w-3" /> Sudah masuk pemasukan
              </Badge>
            ) : (
              <Badge tone="neutral">Belum dicatat</Badge>
            )}

            {isDeficit ? (
              <p className="max-w-[16rem] text-right text-xs text-muted-foreground">
                Saldo bulan lalu minus, jadi tidak bisa dicatat sebagai pemasukan. Tutup dulu
                defisitnya di bulan berjalan.
              </p>
            ) : !hasCarry ? (
              <p className="max-w-[16rem] text-right text-xs text-muted-foreground">
                Belum ada sisa uang dari bulan sebelumnya untuk dibawa ke {periodLabel}.
              </p>
            ) : summary.recorded ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {summary.needsSync ? (
                  <Button size="sm" onClick={() => void sync()} disabled={busy !== null}>
                    {busy === 'sync' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Sesuaikan ke {formatIDR(summary.amount)}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void undo()}
                  disabled={busy !== null}
                >
                  {busy === 'undo' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Batalkan
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => void record()} disabled={busy !== null}>
                {busy === 'record' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Catat sebagai pemasukan
              </Button>
            )}

            {summary.recorded && summary.needsSync ? (
              <p className="max-w-[16rem] text-right text-xs text-muted-foreground">
                Tercatat {formatIDR(summary.recordedAmount)}, seharusnya {formatIDR(summary.amount)} —
                ada transaksi bulan lalu yang berubah.
              </p>
            ) : null}
          </div>
        </div>

        {/* Rantai perhitungan: bulan lalu + bulan ini = total saldo */}
        <div className="grid gap-2 sm:grid-cols-3">
          <StatBox label={`Saldo ${previousLabel}`} value={summary.amount} hint="Dibawa dari bulan lalu" />
          <StatBox
            label={`Arus bersih ${periodLabel}`}
            value={summary.periodNet}
            hint="Masuk − keluar bulan ini"
          />
          <StatBox label="Total saldo akhir" value={summary.endBalance} hint="Siap dibawa ke bulan depan" highlight />
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
          Transaksi berlabel &quot;Saldo sisa bulan lalu&quot; tidak dihitung dua kali, jadi total saldo
          tetap akurat walau kamu mencatatnya sebagai pemasukan.
        </p>
      </CardContent>
    </Card>
  );
}