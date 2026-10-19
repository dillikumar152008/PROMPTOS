'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownOutput } from './markdown-output';
import { Play, AlertCircle, Sparkles, TrendingDown, ShieldCheck } from 'lucide-react';
import { PROMPT_OPTIMIZER_SLUG, parseOptimizationOutput } from '@/lib/ai/optimizer';
import { DlpBanner } from './dlp-banner';
import { scanPrompt, maskPrompt, restorePlaceholders, type Finding } from '@/src/lib/dlp';

export interface SafeAppView {
  id: string;
  name: string;
  tagline: string;
  slug: string;
  input_placeholder: string;
}

interface ExecutionContainerProps {
  app: SafeAppView;
}

export const ExecutionContainer: React.FC<ExecutionContainerProps> = ({ app }) => {
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState<{ latencyMs: number; tokensUsed: number } | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholderMapsRef = useRef<Map<string, Record<string, string>>>(new Map());

  // 1. Live scan input as user types
  const findings: Finding[] = useMemo(() => {
    if (!input) return [];
    return scanPrompt(input);
  }, [input]);

  const isOptimizerApp = app.slug === PROMPT_OPTIMIZER_SLUG || app.name.toLowerCase().includes('prompt optimizer');

  const sampleInputs: Record<string, string> = {
    [PROMPT_OPTIMIZER_SLUG]: `You are a helpful and polite customer support agent for Acme Cloud. When a customer reaches out with a technical issue, always listen carefully and acknowledge their frustration. Provide clear, step-by-step troubleshooting instructions to resolve their problem as quickly as possible. If the issue is related to billing or payment methods, do not attempt to fix it yourself; instead, politely transfer them to billing@acmecloud.com. Always maintain a calm, professional, and empathetic tone throughout the conversation, and never use slang or abbreviations.`,
    'viral-video-hooks': 'How to acquire B2B software companies with zero personal cash down using seller carryback financing.',
    'pg-query-tuner': 'SELECT * FROM events e WHERE e.user_id IN (SELECT id FROM users WHERE status = \'active\') AND e.created_at >= NOW() - INTERVAL \'7 days\';',
    'b2b-inbound-qualifier': 'Name: Sarah Jenkins, VP of Engineering at Datacorp (250 employees). Inbound note: We are looking to migrate from legacy Datadog to ClickHouse in Q2. Current monthly spend is $45,000.',
  };

  const handleLoadSample = () => {
    const sample = sampleInputs[app.slug] || (isOptimizerApp ? sampleInputs[PROMPT_OPTIMIZER_SLUG] : 'Analyze current operations and generate actionable recommendations.');
    setInput(sample);
  };

  // Core execution handler with request-level placeholder map isolation
  const executeRun = async (textToSend: string, mapToRestore?: Record<string, string>) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isRunning) return;

    setIsRunning(true);
    setErrorMsg(null);
    setOutput('');

    const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
    if (mapToRestore && Object.keys(mapToRestore).length > 0) {
      placeholderMapsRef.current.set(reqId, mapToRestore);
    }

    try {
      // Execute via API route: POST /api/apps/[id]/run
      const res = await fetch(`/api/apps/${app.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      const rawOutput = data.output || '';
      const requestMap = placeholderMapsRef.current.get(reqId);
      placeholderMapsRef.current.delete(reqId);

      // Restore placeholders locally in the browser
      const finalOutput = requestMap ? restorePlaceholders(rawOutput, requestMap) : rawOutput;

      setOutput(finalOutput);
      setStats({
        latencyMs: data.latencyMs,
        tokensUsed: data.tokensUsed,
      });
    } catch (err: any) {
      placeholderMapsRef.current.delete(reqId);
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleMaskAndSend = () => {
    const { masked, map } = maskPrompt(input, findings);
    executeRun(masked, map);
  };

  const handleSendAnywayConfirmed = () => {
    executeRun(input);
  };

  const handleEdit = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (findings.length > 0) {
      handleMaskAndSend();
    } else {
      executeRun(input);
    }
  };

  const optimizerMetrics = isOptimizerApp && output ? parseOptimizationOutput(output, input) : null;

  return (
    <div className="promptos-panel rounded-2xl p-6 sm:p-8 space-y-6">
      
      {/* App Header (Safe View: NO system prompt exposed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-sans text-xl font-bold tracking-tight text-white">
              {app.name}
            </h2>
            {isOptimizerApp && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Official Tool</span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {app.tagline}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          className="text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          Paste Sample Prompt
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Single Input Form */}
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-2">
            {isOptimizerApp ? 'Prompt to Optimize' : 'Input'}
          </label>
          <textarea
            ref={textareaRef}
            rows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={app.input_placeholder || 'Enter prompt to optimize...'}
            className={`w-full bg-[#09090b] text-zinc-100 text-xs font-mono p-4 rounded-xl border transition-colors resize-none leading-relaxed focus:outline-none ${
              findings.length > 0
                ? 'border-amber-500/70 focus:border-amber-400'
                : 'border-zinc-800 focus:border-zinc-500'
            }`}
            required
          />
        </div>

        {/* DLP Shield Warning Banner */}
        {findings.length > 0 && (
          <DlpBanner
            findings={findings}
            onMaskAndSend={handleMaskAndSend}
            onEdit={handleEdit}
            disabled={isRunning}
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-mono text-zinc-500">
            Max 5,000 characters
          </span>

          {/* Stark High-Contrast Run Button */}
          <Button
            type="submit"
            variant="solid"
            size="lg"
            disabled={isRunning || !input.trim()}
            className="px-6"
          >
            {isRunning ? (
              <span className="flex items-center space-x-2">
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Optimizing…</span>
              </span>
            ) : findings.length > 0 ? (
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mask & Run</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5">
                <Play className="w-3.5 h-3.5 fill-zinc-950" />
                <span>{isOptimizerApp ? 'Optimize Prompt' : 'Run Mini-App'}</span>
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Prompt Optimizer Token Reduction Card */}
      {optimizerMetrics && (
        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Token Efficiency Analysis</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/80 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-800/50">
              estimated
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-[#09090b]/80 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Before (estimated)</span>
              <span className="text-sm font-semibold text-zinc-200 tabular-nums">{optimizerMetrics.tokensBefore} tokens</span>
            </div>
            <div className="bg-[#09090b]/80 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">After (estimated)</span>
              <span className="text-sm font-semibold text-zinc-200 tabular-nums">{optimizerMetrics.tokensAfter} tokens</span>
            </div>
            <div className="bg-[#09090b]/80 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Saved Tokens</span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                {optimizerMetrics.savedTokens > 0 ? `-${optimizerMetrics.savedTokens}` : '0'} tokens
              </span>
            </div>
            <div className="bg-[#09090b]/80 p-3 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Saved Percent</span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                {optimizerMetrics.savedPercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Output Area */}
      <div className="pt-4 border-t border-zinc-800">
        <MarkdownOutput content={output} stats={stats} />
      </div>

    </div>
  );
};
