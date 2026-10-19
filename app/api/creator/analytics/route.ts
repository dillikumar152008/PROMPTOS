import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, isValidRole } from '@/lib/auth/roles';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Role check
    let role = extractAuthoritativeRole(user);
    if (!role) {
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

    // 1. Fetch apps owned by this creator via adminClient
    const { data: creatorApps, error: appsErr } = await adminClient
      .from('apps')
      .select('id, name, slug, daily_token_limit, created_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (appsErr || !creatorApps || creatorApps.length === 0) {
      return NextResponse.json({
        totalRuns: 0,
        totalTokens: 0,
        activeUsers: 0,
        appBreakdown: [],
      });
    }

    const appIds = creatorApps.map((a) => a.id);

    // 2. Fetch all runs for these apps via adminClient
    const { data: runsData, error: runsErr } = await adminClient
      .from('runs')
      .select('id, app_id, user_id, tokens_used, input_tokens, output_tokens, created_at')
      .in('app_id', appIds)
      .order('created_at', { ascending: false });

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    const runs = runsData || [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let totalRuns = runs.length;
    let totalTokens = 0;
    const activeUsersSet = new Set<string>();

    // Per app metrics map
    const perAppStats: Record<
      string,
      { runs: number; tokens: number; lastRun: string | null; tokensToday: number }
    > = {};

    creatorApps.forEach((a) => {
      perAppStats[a.id] = { runs: 0, tokens: 0, lastRun: null, tokensToday: 0 };
    });

    runs.forEach((r) => {
      const tokens = r.tokens_used || (r.input_tokens || 0) + (r.output_tokens || 0);
      totalTokens += tokens;

      const runTime = new Date(r.created_at).getTime();

      // Active user in last 30 days
      if (r.user_id && runTime >= thirtyDaysAgo) {
        activeUsersSet.add(r.user_id);
      }

      if (perAppStats[r.app_id]) {
        perAppStats[r.app_id].runs += 1;
        perAppStats[r.app_id].tokens += tokens;

        if (!perAppStats[r.app_id].lastRun) {
          perAppStats[r.app_id].lastRun = r.created_at;
        }

        if (runTime >= oneDayAgo) {
          perAppStats[r.app_id].tokensToday += tokens;
        }
      }
    });

    const appBreakdown = creatorApps.map((a) => {
      const stats = perAppStats[a.id] || { runs: 0, tokens: 0, lastRun: null, tokensToday: 0 };
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        runs: stats.runs,
        tokens: stats.tokens,
        lastRun: stats.lastRun ? stats.lastRun.replace('T', ' ').slice(0, 19) : null,
        dailyLimit: a.daily_token_limit || 100000,
        tokensToday: stats.tokensToday,
      };
    });

    return NextResponse.json({
      totalRuns,
      totalTokens,
      activeUsers: activeUsersSet.size,
      appBreakdown,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
