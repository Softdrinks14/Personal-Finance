'use client';

import * as React from 'react';
import { AlertTriangle, FileImage, Loader2, ScanLine, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ocrStatusLabel, parseTransactionsFromText, runOcr } from '@/lib/ocr';
import type { ParsedTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Area drag & drop untuk upload screenshot mutasi / bukti transfer,
 * lalu menjalankan OCR di browser memakai Tesseract.js.
 *
 * Semua proses terjadi di komputer user — gambar tidak diunggah ke server mana pun.
 */

export interface UploadZoneProps {
  onResults: (items: ParsedTransaction[], meta: { text: string; fileNames: string[] }) => void;
}

interface PreviewItem {
  file: File;
  url: string;
}

const ACCEPTED = 'image/png,image/jpeg,image/jpg,image/webp,image/bmp';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onResults }: UploadZoneProps) {
  const [items, setItems] = React.useState<PreviewItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [statusLabel, setStatusLabel] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /** Bersihkan object URL saat komponen dilepas supaya memori tidak bocor. */
  React.useEffect(
    () => () => {
      items.forEach((item) => URL.revokeObjectURL(item.url));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const accepted: PreviewItem[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" lebih dari 10 MB. Kompres dulu ya.`);
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }

    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
    }
  };

  const removeItem = (url: string) => {
    URL.revokeObjectURL(url);
    setItems((prev) => prev.filter((item) => item.url !== url));
  };

  const clearAll = () => {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    setItems([]);
    setError(null);
    setProgress(0);
    setStatusLabel('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const startScan = async () => {
    if (items.length === 0) return;

    setRunning(true);
    setError(null);
    setProgress(0);
    setStatusLabel('Menyiapkan mesin OCR...');

    try {
      let combinedText = '';

      for (let index = 0; index < items.length; index += 1) {
        const { file } = items[index];
        const text = await runOcr(file, (update) => {
          setStatusLabel(`${ocrStatusLabel(update.status)} (${index + 1} dari ${items.length})`);
          // Progres total = file yang sudah selesai + progres file sekarang.
          setProgress(Math.min(1, (index + update.progress) / items.length));
        });
        combinedText += `${text}\n`;
      }

      setProgress(1);
      setStatusLabel('Menganalisis teks...');

      const parsed = parseTransactionsFromText(combinedText);

      if (parsed.length === 0) {
        setError(
          'Teks berhasil dibaca, tapi tidak ada baris yang mirip transaksi. Coba pakai screenshot ' +
            'yang lebih jelas / tidak terpotong, atau input manual saja.',
        );
        return;
      }

      onResults(parsed, {
        text: combinedText,
        fileNames: items.map((item) => item.file.name),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal memproses gambar: ${err.message}`
          : 'Gagal memproses gambar. Coba lagi dengan gambar lain.',
      );
    } finally {
      setRunning(false);
      setStatusLabel('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Kotak drag & drop */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
          running && 'opacity-60',
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </span>

        <div>
          <p className="text-sm font-medium">Tarik & letakkan screenshot di sini</p>
          <p className="mt-1 text-xs text-muted-foreground">
            atau{' '}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2"
              onClick={() => inputRef.current?.click()}
              disabled={running}
            >
              pilih file dari komputer
            </button>
            . Mendukung PNG, JPG, WEBP (maks. 10 MB per gambar).
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>

      {/* Daftar gambar yang siap diproses */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {items.length} gambar siap diproses
            </p>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={running}>
              <Trash2 className="h-3.5 w-3.5" /> Bersihkan
            </Button>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.url}
                className="flex items-center gap-3 rounded-md border border-border bg-background p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{item.file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(item.file.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Hapus ${item.file.name}`}
                  onClick={() => removeItem(item.url)}
                  disabled={running}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {/* Progres OCR */}
          {running ? (
            <div className="flex flex-col gap-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {statusLabel || 'Memproses...'}
              </p>
            </div>
          ) : (
            <Button onClick={startScan} className="w-full sm:w-auto sm:self-start">
              <ScanLine className="h-4 w-4" />
              Mulai Scan Otomatis (OCR)
            </Button>
          )}
        </div>
      ) : null}

      {/* Pesan error */}
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      ) : null}

      {/* Info kecil */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <FileImage className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong className="font-medium text-foreground">Tips supaya hasil OCR akurat:</strong> pakai
          screenshot asli (bukan hasil foto miring), pastikan tulisan nominal tidak terpotong, dan
          pilih tampilan mutasi yang menampilkan tanggal + keterangan + nominal dalam satu baris.
          Saat pertama kali dipakai, aplikasi mengunduh data bahasa (±10 MB) sekali saja.
        </p>
      </div>
    </div>
  );
}
