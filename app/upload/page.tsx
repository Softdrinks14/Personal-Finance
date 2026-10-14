'use client';

import * as React from 'react';
import Link from 'next/link';
import { Camera, Info, ListChecks, ScanLine, Sparkles } from 'lucide-react';
import { useData } from '@/components/data-provider';
import { DataModeBanner } from '@/components/data-mode-banner';
import { AppShell } from '@/components/layout/app-shell';
import { OcrReviewTable } from '@/components/ocr-review-table';
import { UploadZone } from '@/components/upload-zone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { guessCategoryName } from '@/lib/ocr';
import type { ParsedTransaction, TransactionInput } from '@/lib/types';

/**
 * HALAMAN SCAN SCREENSHOT  (route: "/upload")
 *
 * Alur 3 langkah:
 *   1. Upload screenshot mutasi / bukti transfer
 *   2. OCR membaca teks, parser menebak tanggal + nominal + keterangan
 *   3. User review & koreksi, baru disimpan
 */
export default function UploadPage() {
  const { categories, addTransactions } = useData();

  const [items, setItems] = React.useState<ParsedTransaction[] | null>(null);
  const [rawText, setRawText] = React.useState('');
  const [fileNames, setFileNames] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  /** Peta nama kategori -> id, untuk mengisi kolom kategori otomatis. */
  const categoryIdByName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.name.toLowerCase(), category.id);
    return map;
  }, [categories]);

  const handleResults = (
    parsed: ParsedTransaction[],
    meta: { text: string; fileNames: string[] },
  ) => {
    // Isi kategori otomatis dari tebakan kata kunci pada deskripsi.
    const enriched = parsed.map((item) => {
      const guessed = guessCategoryName(item.description, item.type);
      return {
        ...item,
        category_id: guessed ? categoryIdByName.get(guessed.toLowerCase()) ?? null : null,
      };
    });

    setItems(enriched);
    setRawText(meta.text);
    setFileNames(meta.fileNames);
  };

  const handleSave = async (inputs: TransactionInput[]) => {
    setSaving(true);
    try {
      await addTransactions(inputs);
      setItems(null);
      setRawText('');
      setFileNames([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Judul */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scan Screenshot Mutasi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Unggah screenshot m-banking, lalu biarkan aplikasi membaca nominalnya untukmu.
            </p>
          </div>
          <Link href="/transactions">
            <Button variant="outline">
              <ListChecks className="h-4 w-4" /> Lihat riwayat
            </Button>
          </Link>
        </div>

        <DataModeBanner />

        {/* Penjelasan cara kerja */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Camera,
              title: '1. Unggah gambar',
              text: 'Tarik screenshot bukti transfer atau mutasi rekening ke area di bawah.',
            },
            {
              icon: ScanLine,
              title: '2. OCR membaca teks',
              text: 'Tesseract.js membaca tulisan di gambar langsung di browser-mu (tanpa API key).',
            },
            {
              icon: Sparkles,
              title: '3. Review & simpan',
              text: 'Periksa hasilnya, koreksi kalau ada yang salah, baru simpan ke catatan.',
            },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.title}>
                <CardContent className="flex gap-3 p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{step.text}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Area upload */}
        <Card>
          <CardHeader>
            <CardTitle>Unggah Screenshot</CardTitle>
            <CardDescription>
              Bisa beberapa gambar sekaligus (misal mutasi 1 bulan penuh yang dipecah beberapa screenshot).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadZone onResults={handleResults} />
          </CardContent>
        </Card>

        {/* Hasil review */}
        {items && items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Review Hasil Ekstraksi</CardTitle>
              <CardDescription>
                Terbaca dari: {fileNames.join(', ')}. Semua kolom bisa diedit sebelum disimpan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OcrReviewTable
                key={fileNames.join('|') + items.length}
                items={items}
                onChange={setItems}
                categories={categories}
                onSave={handleSave}
                onDiscard={() => {
                  setItems(null);
                  setRawText('');
                  setFileNames([]);
                }}
                saving={saving}
              />
            </CardContent>
          </Card>
        ) : null}

        {/* Teks mentah hasil OCR (untuk memeriksa kalau ada yang aneh) */}
        {rawText ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" /> Teks Mentah Hasil OCR
              </CardTitle>
              <CardDescription>
                Berguna untuk memastikan OCR membaca gambar dengan benar. Kalau teksnya berantakan,
                coba screenshot yang lebih besar / lebih jelas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="scrollbar-thin max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                {rawText}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
