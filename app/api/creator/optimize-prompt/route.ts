import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, isValidRole } from '@/lib/auth/roles';
import { executeModelPrompt, checkRateLimit, getUserFacingAIErrorMessage, MAX_INPUT_CHARACTERS } from '@/lib/ai/provider';
import { PROMPT_OPTIMIZER_SYSTEM_PROMPT, parseOptimizationOutput } from '@/lib/ai/optimizer';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Server-side authoritative creator role verification
    let role = extractAuthoritativeRole(user);
    if (!role) {
      const { data: profile } = await supabase
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
    const promptToOptimize = (body?.prompt || '').trim();

    if (!promptToOptimize) {
      return NextResponse.json({ error: 'Valid prompt is required.' }, { status: 400 });
    }

    if (promptToOptimize.length > MAX_INPUT_CHARACTERS) {
      return NextResponse.json(
        { error: `Input exceeds maximum limit of ${MAX_INPUT_CHARACTERS} characters.` },
        { status: 400 }
      );
    }

    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: Maximum 20 mini-app executions per minute.' },
        { status: 429 }
      );
    }

    const modelResult = await executeModelPrompt({
      systemPrompt: PROMPT_OPTIMIZER_SYSTEM_PROMPT,
      userInput: promptToOptimize,
      maxOutputTokens: 2048,
    });

    const parsed = parseOptimizationOutput(modelResult.text, promptToOptimize);

    return NextResponse.json({
      optimizedPrompt: parsed.optimizedPrompt,
      changes: parsed.changes,
      warning: parsed.warning,
      tokensBefore: parsed.tokensBefore,
      tokensAfter: parsed.tokensAfter,
      savedTokens: parsed.savedTokens,
      savedPercent: parsed.savedPercent,
    });
  } catch (err: any) {
    const { message, status } = getUserFacingAIErrorMessage(err);
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
