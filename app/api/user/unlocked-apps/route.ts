import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    // 1. Fetch user's app_access records
    const { data: accessList, error: accessError } = await supabase
      .from('app_access')
      .select('app_id')
      .eq('user_id', user.id);

    if (accessError || !accessList || accessList.length === 0) {
      return NextResponse.json([]);
    }

    const appIds = accessList.map((item) => item.app_id);

    // 2. Fetch safe_apps for these IDs (omitting system_prompt)
    const { data: apps, error: appsError } = await supabase
      .from('safe_apps')
      .select('id, name, tagline, slug, input_placeholder, creator_name, access_mode, status')
      .in('id', appIds)
      .eq('status', 'active');

    if (appsError || !apps) {
      return NextResponse.json([]);
    }

    return NextResponse.json(apps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
