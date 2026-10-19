import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}

  const cookieStore = cookies();
  cookieStore.delete('promptos_session');

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL('/', origin), { status: 303 });
  response.cookies.delete('promptos_session');

  return response;
}
