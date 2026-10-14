'use client';

import * as React from 'react';
import { Pencil, ScanLine, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Category, Transaction } from '@/lib/types';
import { formatDateID, formatIDR } from '@/lib/utils';

/**
 * Tabel daftar transaksi dengan tombol edit & hapus.
 * Konfirmasi hapus memakai dialog supaya tidak terhapus karena salah klik.
 */

export interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => Promise<void> | void;
  emptyMessage?: string;
}

export function TransactionTable({
  transactions,
  categories,
  onEdit,
  onDelete,
  emptyMessage = 'Belum ada transaksi.',
}: TransactionTableProps) {
  const [pendingDelete, setPendingDelete] = React.useState<Transaction | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const confirmDelete = async () => {
    if (!pendingDelete || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Tanggal</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead className="hidden sm:table-cell">Kategori</TableHead>
            <TableHead className="text-right">Nominal</TableHead>
            <TableHead className="w-[96px] text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const category = tx.category_id ? categoryById.get(tx.category_id) : undefined;
            const isIncome = tx.type === 'income';

            return (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateID(tx.date)}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium leading-snug">
                      {tx.note || <span className="text-muted-foreground">Tanpa keterangan</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {tx.source === 'ocr' ? (
                        <>
                          <ScanLine className="h-3 w-3" /> Hasil scan
                        </>
                      ) : (
                        'Input manual'
                      )}
                      {category ? (
                        <span className="sm:hidden">
                          · <span style={{ color: category.color }}>{category.name}</span>
                        </span>
                      ) : null}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="hidden sm:table-cell">
                  {category ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Tanpa kategori</span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <span
                    className={
                      isIncome
                        ? 'tabular whitespace-nowrap font-semibold text-success'
                        : 'tabular whitespace-nowrap font-semibold text-destructive'
                    }
                  >
                    {isIncome ? '+' : '−'} {formatIDR(tx.amount)}
                  </span>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit transaksi"
                        title="Edit"
                        onClick={() => onEdit(tx)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Hapus transaksi"
                        title="Hapus"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPendingDelete(tx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Hapus transaksi ini?"
        description="Data yang sudah dihapus tidak bisa dikembalikan."
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
              Ya, hapus
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Tanggal</span>
              <span className="font-medium">{formatDateID(pendingDelete.date)}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Keterangan</span>
              <span className="font-medium">{pendingDelete.note || 'Tanpa keterangan'}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Nominal</span>
              <span className="tabular font-semibold">{formatIDR(pendingDelete.amount)}</span>
            </p>
            <div className="pt-1">
              <Badge tone={pendingDelete.type === 'income' ? 'income' : 'expense'}>
                {pendingDelete.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </Badge>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
