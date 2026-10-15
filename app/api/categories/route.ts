import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-guard';

/**
 * API ROUTE: /api/categories
 * ------------------------------------------------------------------
 * GET  /api/categories  -> daftar kategori MILIK SAYA
 * POST /api/categories  -> tambah kategori baru milik saya
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, supabase, error } = await requireApiUser();
  if (error) return error;

  const { data, error: queryError } = await supabase!
    .from('categories')
    .select('*')
    .eq('user_id', user!.id)
    .order('name');

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], count: data?.length ?? 0 });
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

  const name = String(body?.name ?? '').trim();
  const type = body?.type ?? 'expense';
  const color = String(body?.color ?? '#64748b');

  if (name.length < 2) {
    return NextResponse.json({ error: "Field 'name' minimal 2 karakter." }, { status: 400 });
  }
  if (!['income', 'expense', 'both'].includes(type)) {
    return NextResponse.json({ error: "Field 'type' harus 'income', 'expense', atau 'both'." }, { status: 400 });
  }

  const { data, error: insertError } = await supabase!
    .from('categories')
    .insert({ user_id: user!.id, name, type, color })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
