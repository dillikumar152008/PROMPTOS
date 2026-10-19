import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, isValidRole } from '@/lib/auth/roles';
import { executeModelPrompt, getUserFacingAIErrorMessage } from '@/lib/ai/provider';

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
    const idea = (body?.idea || '').trim();

    if (!idea) {
      return NextResponse.json({ error: 'Please describe your app idea.' }, { status: 400 });
    }

    if (idea.length > 2000) {
      return NextResponse.json(
        { error: `App idea exceeds 2,000 characters limit (received ${idea.length}).` },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert AI software architect for PromptOS, a platform for single-purpose AI mini-apps.
Given a user's plain-English idea, design a complete mini-app specification.
You MUST output ONLY a valid JSON object with EXACTLY these keys:
- "name": Concise tool name (2-5 words).
- "description": Plain-language explanation of what this tool does (1 sentence).
- "systemPrompt": Thorough, precise, production-ready system instructions for the AI runner when an end-user provides input.
- "inputLabel": A short, clear label for the end-user's input box (e.g. "Draft email", "Meeting notes", "Target URL").
- "inputPlaceholder": Realistic example input text to guide the user.

Output strictly valid JSON. Do not include introductory text, conversational remarks, or trailing markdown beyond the JSON.`;

    const modelResult = await executeModelPrompt({
      systemPrompt,
      userInput: `App idea: ${idea}`,
      maxOutputTokens: 1024,
      modelOverride: process.env.AI_MODEL_GENERATE,
    });

    let rawText = modelResult.text.trim();
    // Strip markdown code fences if present
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback parser if JSON was slightly malformed or wrapped
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Something went wrong. Please try again.');
      }
    }

    const validatedApp = {
      name: String(parsed.name || idea.slice(0, 40)).trim(),
      description: String(parsed.description || 'Single-purpose AI mini-app.').trim(),
      systemPrompt: String(parsed.systemPrompt || `Execute the following single-purpose task: ${idea}`).trim(),
      inputLabel: String(parsed.inputLabel || 'Input').trim(),
      inputPlaceholder: String(parsed.inputPlaceholder || 'Provide input...').trim(),
    };

    return NextResponse.json(validatedApp);
  } catch (err: any) {
    const { message, status } = getUserFacingAIErrorMessage(err);
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
