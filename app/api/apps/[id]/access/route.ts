import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const appId = params.id;
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Resolve app record using admin client (user might not yet have claimed access)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId);
    let appRecord: any = null;

    if (isUuid) {
      const { data } = await adminClient.from('apps').select('id, access_mode, creator_id').eq('id', appId).single();
      appRecord = data;
    } else {
      const { data } = await adminClient.from('apps').select('id, access_mode, creator_id').eq('slug', appId).single();
      appRecord = data;
    }

    if (!appRecord) {
      return NextResponse.json({ error: 'Mini-app not found.' }, { status: 404 });
    }

    if (appRecord.access_mode === 'open') {
      return NextResponse.json({ hasAccess: true, accessMode: 'open' });
    }

    if (!user) {
      return NextResponse.json({ hasAccess: false, accessMode: appRecord.access_mode });
    }

    if (user.id === appRecord.creator_id) {
      return NextResponse.json({ hasAccess: true, accessMode: appRecord.access_mode, isCreator: true });
    }

    // Check app_access table via adminClient
    const { data: accessRecord } = await adminClient
      .from('app_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('app_id', appRecord.id)
      .single();

    return NextResponse.json({
      hasAccess: !!accessRecord,
      accessMode: appRecord.access_mode,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const appId = params.id;
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId);
    let appRecord: any = null;

    if (isUuid) {
      const { data } = await adminClient.from('apps').select('id, access_mode').eq('id', appId).single();
      appRecord = data;
    } else {
      const { data } = await adminClient.from('apps').select('id, access_mode').eq('slug', appId).single();
      appRecord = data;
    }

    if (!appRecord) {
      return NextResponse.json({ error: 'Mini-app not found.' }, { status: 404 });
    }

    if (appRecord.access_mode === 'invite_only') {
      return NextResponse.json(
        { error: 'This mini-app is invite-only. Contact the creator for an access grant.' },
        { status: 403 }
      );
    }

    // Insert access pass into app_access table using adminClient
    const { error: insertError } = await adminClient
      .from('app_access')
      .upsert({
        user_id: user.id,
        app_id: appRecord.id,
        access_type: appRecord.access_mode === 'paid' ? 'purchased' : 'claimed',
      }, { onConflict: 'user_id,app_id' });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Access pass successfully claimed.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
