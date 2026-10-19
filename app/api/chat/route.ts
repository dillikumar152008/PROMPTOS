import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { prepareMessage } from '@/lib/chat/prepare';
import { extractMaxIndices } from '@/src/lib/dlp';

export async function POST(request: Request) {
  try {
    // a. Auth with the cookie-based server client; no user -> 401
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // b. Validate message: string, trimmed, 1 to 4000 chars, else 400
    // (Never log request body or message content)
    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Valid message string is required.' },
        { status: 400 }
      );
    }

    const rawMessage = body.message.trim();
    if (rawMessage.length < 1 || rawMessage.length > 4000) {
      return NextResponse.json(
        { error: 'Message must be between 1 and 4000 characters.' },
        { status: 400 }
      );
    }

    // c. Rate limit: count this user's role='user' messages in the last 60 seconds; if >= 10 return 429
    // If the count query errors, fail closed (503)
    const sixtySecsAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countErr } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', sixtySecsAgo);

    if (countErr) {
      console.error('[Chat Rate Limit Query Error]', countErr.message);
      return NextResponse.json(
        { error: 'The AI service is busy, try again.' },
        { status: 503 }
      );
    }

    if (count !== null && count >= 10) {
      return NextResponse.json(
        { error: 'You are sending messages too fast. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    // d. Validate conversationId if provided (must match UUID format)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let conversationId: string | null = null;

    if (body.conversationId !== undefined && body.conversationId !== null) {
      if (typeof body.conversationId !== 'string' || !UUID_REGEX.test(body.conversationId)) {
        return NextResponse.json(
          { error: 'Invalid conversationId.' },
          { status: 400 }
        );
      }

      // Load conversation with user's client (RLS enforces user_id = auth.uid())
      const { data: existingConv, error: loadErr } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', body.conversationId)
        .maybeSingle();

      if (loadErr) {
        console.error('[Load Conversation Error]', loadErr.message);
        return NextResponse.json(
          { error: 'Conversation not found.' },
          { status: 404 }
        );
      }

      if (!existingConv) {
        return NextResponse.json(
          { error: 'Conversation not found.' },
          { status: 404 }
        );
      }

      conversationId = existingConv.id;
    }

    // e. If conversation exists, load the last 20 messages, oldest first
    let history: { role: string; content: string }[] = [];
    if (conversationId) {
      const { data: recentMsgs, error: msgsErr } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (msgsErr) {
        console.error('[Load Messages Error]', msgsErr.message);
        return NextResponse.json(
          { error: 'Failed to load conversation history.' },
          { status: 500 }
        );
      }

      // Reverse descending records to get chronological oldest-first order
      history = (recentMsgs || []).reverse();
    }

    // f. Call Gemini with @google/genai, model from process.env.GEMINI_MODEL
    const model = process.env.GEMINI_MODEL;
    if (!model) {
      console.error('[Gemini Config Error] GEMINI_MODEL is missing.');
      return NextResponse.json(
        { error: 'The AI service is busy, try again.' },
        { status: 503 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[Gemini Config Error] GEMINI_API_KEY is missing.');
      return NextResponse.json(
        { error: 'The AI service is busy, try again.' },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Compute max placeholder indices from conversation history
    const baseCounts = extractMaxIndices(history.map((m) => m.content));

    // Ensure Gemini receives ONLY masked text for both history and the new message
    const contents = history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: prepareMessage(msg.content) }],
    }));

    // Mask the new message through prepareMessage with baseCounts offset before forwarding
    const safeUserMessage = prepareMessage(rawMessage, baseCounts);
    contents.push({
      role: 'user',
      parts: [{ text: safeUserMessage }],
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let outputText = '';
    let lastAiError: any = null;
    const maxRetries = 2;

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: 'You are PromptOS, a helpful assistant.',
              abortSignal: controller.signal,
            },
          });

          outputText = response.text?.trim() || '';
          if (outputText) {
            lastAiError = null;
            break;
          }
        } catch (aiErr: any) {
          lastAiError = aiErr;
          const errMsg = aiErr?.message || '';
          // If transient 503 / high demand spike, wait briefly and retry
          if (
            attempt < maxRetries &&
            (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE'))
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          break;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!outputText && lastAiError) {
      console.error('[Gemini Chat Error]', lastAiError?.message || 'Execution error');
      return NextResponse.json(
        { error: 'The AI service is busy, try again.' },
        { status: 503 }
      );
    }

    // g. Empty output -> 422
    if (!outputText) {
      return NextResponse.json(
        { error: 'No result was generated. Try rephrasing.' },
        { status: 422 }
      );
    }

    // Prepare assistant message via DLP mask, offsetting from history + user message
    const assistantBaseCounts = extractMaxIndices([
      ...history.map((m) => m.content),
      safeUserMessage,
    ]);
    const safeAssistantMessage = prepareMessage(outputText, assistantBaseCounts);

    // h. Conversation creation (AFTER Gemini succeeds):
    // If no conversationId, create it now with title derived from prepareMessage(rawMessage, baseCounts).slice(0, 40)
    if (!conversationId) {
      const cleanTitle = prepareMessage(rawMessage, baseCounts).slice(0, 40) || 'New conversation';
      const { data: newConv, error: createErr } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: cleanTitle,
        })
        .select('id')
        .single();

      if (createErr || !newConv) {
        console.error('[Create Conversation Error]', createErr?.message);
        // Per requirements: log error.message only, and still return output if reply was generated
        return NextResponse.json({
          conversationId: null,
          output: safeAssistantMessage,
        });
      }

      conversationId = newConv.id;
    }

    // i. Insert user message and assistant message as two separate, sequential inserts
    // so their created_at timestamps differ
    if (conversationId) {
      const { error: insertUserErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: safeUserMessage,
      });

      if (insertUserErr) {
        console.error('[Insert User Message Error]', insertUserErr.message);
      }

      const { error: insertAssistantErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: safeAssistantMessage,
      });

      if (insertAssistantErr) {
        console.error('[Insert Assistant Message Error]', insertAssistantErr.message);
      }

      // Update conversation updated_at
      const { error: updateConvErr } = await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (updateConvErr) {
        console.error('[Update Conversation Error]', updateConvErr.message);
      }
    }

    // Return { conversationId, output } (restoring placeholders happens in browser only)
    return NextResponse.json({
      conversationId,
      output: safeAssistantMessage,
    });
  } catch (err: any) {
    console.error('[Chat Handler Unexpected Error]', err?.message || 'Server error');
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
