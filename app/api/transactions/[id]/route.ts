import { NextResponse } from 'next/server';
import { getSupabase, SUPABASE_SETUP_HINT } from '@/lib/supabase';

/**
 * API ROUTE: /api/transactions/[id]
 * ------------------------------------------------------------------
 * PATCH  /api/transactions/<id>  -> perbarui sebagian field
 * DELETE /api/transactions/<id>  -> hapus satu transaksi
 *
 * Catatan Next.js 15+: `params` sekarang berupa Promise, jadi harus
 * di-await sebelum dipakai.
 */

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.', hint: SUPABASE_SETUP_HINT }, { status: 503 });
  }

  const { id } = await context.params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON yang valid.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body?.type !== undefined) {
    if (body.type !== 'income' && body.type !== 'expense') {
      return NextResponse.json({ error: "Field 'type' harus 'income' atau 'expense'." }, { status: 400 });
    }
    patch.type = body.type;
  }

  if (body?.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Field 'amount' harus angka lebih dari 0." }, { status: 400 });
    }
    patch.amount = amount;
  }

  if (body?.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
      return NextResponse.json({ error: "Field 'date' harus format YYYY-MM-DD." }, { status: 400 });
    }
    patch.date = body.date;
  }

  if (body?.category_id !== undefined) patch.category_id = body.category_id;
  if (body?.note !== undefined) patch.note = body.note;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Tidak ada field yang bisa diperbarui.' }, { status: 400 });
  }

  const { data, error } = await client
    .from('transactions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.', hint: SUPABASE_SETUP_HINT }, { status: 503 });
  }

  const { id } = await context.params;

  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id });
}
