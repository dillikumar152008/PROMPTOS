import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const appId = params.id;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const adminClient = await createAdminClient();

    // Verify creator ownership
    const { data: existingApp } = await adminClient
      .from('apps')
      .select('id, creator_id')
      .eq('id', appId)
      .single();

    if (!existingApp) {
      return NextResponse.json({ error: 'Mini-app not found.' }, { status: 404 });
    }

    if (existingApp.creator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this mini-app.' }, { status: 403 });
    }

    const allowedUpdates: Record<string, any> = {};
    if (typeof body.status === 'string' && ['active', 'paused', 'archived'].includes(body.status)) {
      allowedUpdates.status = body.status;
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      allowedUpdates.name = body.name.trim();
    }
    if (typeof body.description === 'string') {
      allowedUpdates.description = body.description.trim();
    }
    if (typeof body.input_label === 'string') {
      allowedUpdates.input_label = body.input_label.trim();
    }
    if (typeof body.input_placeholder === 'string') {
      allowedUpdates.input_placeholder = body.input_placeholder.trim();
    }
    if (typeof body.access_mode === 'string' && ['open', 'invite_only', 'paid'].includes(body.access_mode)) {
      allowedUpdates.access_mode = body.access_mode;
    }
    if (typeof body.system_prompt === 'string' && body.system_prompt.trim()) {
      allowedUpdates.system_prompt = body.system_prompt.trim();
    }

    allowedUpdates.updated_at = new Date().toISOString();

    const { data: updatedApp, error } = await adminClient
      .from('apps')
      .update(allowedUpdates)
      .eq('id', appId)
      .select('id, name, description, slug, access_mode, status, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedApp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const appId = params.id;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Verify creator ownership
    const { data: existingApp } = await adminClient
      .from('apps')
      .select('id, creator_id')
      .eq('id', appId)
      .single();

    if (!existingApp) {
      return NextResponse.json({ error: 'Mini-app not found.' }, { status: 404 });
    }

    if (existingApp.creator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this mini-app.' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('apps')
      .delete()
      .eq('id', appId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Mini-app deleted.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
