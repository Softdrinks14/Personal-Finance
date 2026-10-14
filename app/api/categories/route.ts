import { NextResponse } from 'next/server';
import { getSupabase, SUPABASE_SETUP_HINT } from '@/lib/supabase';

/**
 * API ROUTE: /api/categories
 * ------------------------------------------------------------------
 * GET  /api/categories  -> daftar kategori
 * POST /api/categories  -> tambah kategori baru
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.', hint: SUPABASE_SETUP_HINT }, { status: 503 });
  }

  const { data, error } = await client.from('categories').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.', hint: SUPABASE_SETUP_HINT }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON yang valid.' }, { status: 400 });
  }

  const name = String(body?.name ?? '').trim();
  const type = body?.type ?? 'expense';
  const color = String(body?.color ?? '#64748b');

  if (name.length < 2) {
    return NextResponse.json({ error: "Field 'name' minimal 2 karakter." }, { status: 400 });
  }
  if (!['income', 'expense', 'both'].includes(type)) {
    return NextResponse.json({ error: "Field 'type' harus 'income', 'expense', atau 'both'." }, { status: 400 });
  }

  const { data, error } = await client
    .from('categories')
    .insert({ name, type, color })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
