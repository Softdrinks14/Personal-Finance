import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-guard';
import type { TxType } from '@/lib/types';

/**
 * API ROUTE: /api/transactions
 * ------------------------------------------------------------------
 * GET  /api/transactions            -> daftar transaksi MILIK SAYA
 * GET  /api/transactions?month=2026-10&type=expense
 * POST /api/transactions            -> simpan transaksi baru milik saya
 *
 * Hanya mengembalikan data milik pengguna yang sedang login. Ini dijamin
 * oleh dua hal sekaligus:
 *   1. filter `.eq('user_id', user.id)` di bawah
 *   2. Row Level Security di database (`auth.uid() = user_id`)
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user, supabase, error } = await requireApiUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const type = searchParams.get('type');

  let query = supabase!
    .from('transactions')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false });

  if (type === 'income' || type === 'expense') {
    query = query.eq('type', type);
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    query = query.gte('date', `${month}-01`).lte('date', `${month}-31`);
  }

  const { data, error: queryError } = await query;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((row: any) => ({
      ...row,
      amount: Number(row.amount) || 0,
      date: String(row.date).slice(0, 10),
    })),
    count: data?.length ?? 0,
  });
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireApiUser();
  if (error) return error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON yang valid.' }, { status: 400 });
  }

  const type = body?.type as TxType;
  const amount = Number(body?.amount);
  const date = String(body?.date ?? '');

  if (type !== 'income' && type !== 'expense') {
    return NextResponse.json({ error: "Field 'type' harus 'income' atau 'expense'." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Field 'amount' harus angka lebih dari 0." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Field 'date' harus format YYYY-MM-DD." }, { status: 400 });
  }

  const { data, error: insertError } = await supabase!
    .from('transactions')
    .insert({
      // Dipaksa milik pengguna yang login — tidak bisa ditentukan dari body.
      user_id: user!.id,
      type,
      amount,
      date,
      category_id: body?.category_id ?? null,
      note: body?.note ?? null,
      source: body?.source === 'ocr' ? 'ocr' : 'manual',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
