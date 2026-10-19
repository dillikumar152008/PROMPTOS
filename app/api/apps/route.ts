import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, isValidRole } from '@/lib/auth/roles';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorFilter = searchParams.get('creator');
    const slugFilter = searchParams.get('slug');

    const supabase = await createClient();

    // 1. Single slug lookup for unclaimed apps on the /app/<slug> access screen
    // Uses service role server-side and returns only safe preview columns (NO enumeration)
    if (slugFilter) {
      const adminClient = await createAdminClient();
      const { data: app, error } = await adminClient
        .from('apps')
        .select(`
          id,
          name,
          description,
          slug,
          input_label,
          input_placeholder,
          access_mode,
          status,
          creator:profiles!creator_id(full_name)
        `)
        .eq('slug', slugFilter)
        .eq('status', 'active')
        .single();

      if (error || !app) {
        return NextResponse.json({ error: 'Mini-app not found.' }, { status: 404 });
      }

      const creatorName = (app.creator as any)?.full_name || 'PromptOS Creator';

      return NextResponse.json({
        id: app.id,
        name: app.name,
        description: app.description,
        tagline: app.description,
        slug: app.slug,
        input_label: app.input_label || 'Input',
        input_placeholder: app.input_placeholder || 'Provide input...',
        access_mode: app.access_mode || 'open',
        status: app.status,
        creator_name: creatorName,
      });
    }

    // 2. Creator dashboard apps query
    // Creators read system_prompt only via server routes using service role after validating session
    if (creatorFilter === 'me') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json([], { status: 200 });
      }

      const adminClient = await createAdminClient();
      const { data: creatorApps, error: appsError } = await adminClient
        .from('apps')
        .select('id, name, description, system_prompt, input_label, input_placeholder, slug, access_mode, status, daily_token_limit, created_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (appsError || !creatorApps) {
        return NextResponse.json([]);
      }

      const appIds = creatorApps.map((a) => a.id);
      let runsMap: Record<string, { count: number; tokens: number }> = {};

      if (appIds.length > 0) {
        const { data: runsData } = await adminClient
          .from('runs')
          .select('app_id, tokens_used, input_tokens, output_tokens')
          .in('app_id', appIds);

        if (runsData) {
          for (const r of runsData) {
            if (!runsMap[r.app_id]) {
              runsMap[r.app_id] = { count: 0, tokens: 0 };
            }
            runsMap[r.app_id].count += 1;
            runsMap[r.app_id].tokens += (r.tokens_used || (r.input_tokens || 0) + (r.output_tokens || 0));
          }
        }
      }

      const formattedApps = creatorApps.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        system_prompt: a.system_prompt,
        input_label: a.input_label || 'Input',
        input_placeholder: a.input_placeholder || 'Provide input...',
        slug: a.slug,
        access_mode: a.access_mode || 'open',
        status: a.status || 'active',
        daily_token_limit: a.daily_token_limit || 100000,
        runsCount: runsMap[a.id]?.count || 0,
        tokensUsed: runsMap[a.id]?.tokens ? runsMap[a.id].tokens.toLocaleString() : '0',
        createdAt: a.created_at ? a.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      }));

      return NextResponse.json(formattedApps);
    }

    // Prohibit listing or enumerating apps:
    // If neither single slug lookup nor creatorFilter=me is specified, return empty array.
    return NextResponse.json([]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Authoritative creator role verification
    let role = extractAuthoritativeRole(user);
    if (!role) {
      const adminClient = await createAdminClient();
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile && isValidRole(profile.role)) {
        role = profile.role;
      }
    }

    if (role !== 'creator') {
      return NextResponse.json({ error: 'Forbidden: Creator access required.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      title,
      description,
      systemPrompt,
      prompt,
      inputLabel,
      inputPlaceholder,
      accessMode,
    } = body;

    const appName = (name || title || '').trim();
    const appPrompt = (systemPrompt || prompt || '').trim();
    const appDesc = (description || appPrompt.slice(0, 100) || 'Single-purpose AI mini-app.').trim();

    if (!appName || !appPrompt) {
      return NextResponse.json({ error: 'Name and system prompt are required.' }, { status: 400 });
    }

    // Generate unguessable slug: <title-slug>-<random 8-12 char suffix>
    const cleanTitle = appName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'app';
    const randomSuffix = Math.random().toString(36).substring(2, 12);
    const uniqueSlug = `${cleanTitle}-${randomSuffix}`;

    const validAccessMode = ['open', 'invite_only', 'paid'].includes(accessMode) ? accessMode : 'open';

    const insertPayload = {
      creator_id: user.id,
      name: appName,
      description: appDesc,
      system_prompt: appPrompt,
      input_label: (inputLabel || 'Input').trim(),
      input_placeholder: (inputPlaceholder || 'Provide input...').trim(),
      slug: uniqueSlug,
      access_mode: validAccessMode,
      status: 'active',
      daily_token_limit: 100000,
    };

    // Writes of system_prompt go through server routes using service role
    const adminClient = await createAdminClient();
    const { data: insertedApp, error: insertError } = await adminClient
      .from('apps')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: insertedApp.id,
      name: insertedApp.name,
      description: insertedApp.description,
      slug: insertedApp.slug,
      input_label: insertedApp.input_label,
      input_placeholder: insertedApp.input_placeholder,
      access_mode: insertedApp.access_mode,
      status: insertedApp.status,
      runsCount: 0,
      tokensUsed: '0',
      createdAt: insertedApp.created_at ? insertedApp.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
