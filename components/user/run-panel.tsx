'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PublishedApp, AppRun } from '@/types/app';
import { Play, Copy, Check, Clock, AlertCircle, Terminal, RotateCcw, ShieldCheck } from 'lucide-react';
import { MarkdownOutput } from './markdown-output';
import { DlpBanner } from './dlp-banner';
import { scanPrompt, maskPrompt, restorePlaceholders, type Finding } from '@/src/lib/dlp';

interface RunPanelProps {
  app: PublishedApp;
  userId: string;
}

export const RunPanel: React.FC<RunPanelProps> = ({ app, userId }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Past runs state
  const [pastRuns, setPastRuns] = useState<AppRun[]>([]);
  const [isLoadingPastRuns, setIsLoadingPastRuns] = useState(false);
  const [selectedPastRun, setSelectedPastRun] = useState<AppRun | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  // In-memory placeholder map storage: Map<requestId, Record<placeholder, originalValue>>
  // Never stored in browser storage, cookies, the database, logs, or backend requests.
  const placeholderMapsRef = useRef<Map<string, Record<string, string>>>(new Map());

  // 1. Live scan the input as the user types
  const findings: Finding[] = useMemo(() => {
    if (!input || selectedPastRun) return [];
    return scanPrompt(input);
  }, [input, selectedPastRun]);

  // Load past runs for this app and user (newest first)
  const fetchPastRuns = useCallback(async () => {
    if (!userId || !app.id) return;
    setIsLoadingPastRuns(true);
    try {
      const { data, error } = await supabase
        .from('app_runs')
        .select('id, app_id, user_id, input, output, created_at')
        .eq('app_id', app.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch past runs:', error.message);
      } else {
        setPastRuns(data || []);
      }
    } catch (err) {
      console.error('Error fetching past runs:', err);
    } finally {
      setIsLoadingPastRuns(false);
    }
  }, [app.id, userId, supabase]);

  useEffect(() => {
    // Reset view state when app changes
    setInput('');
    setOutput('');
    setErrorMessage(null);
    setSelectedPastRun(null);
    setCopied(false);
    placeholderMapsRef.current.clear();
    fetchPastRuns();
  }, [app.id, fetchPastRuns]);

  // Core execution handler associating each request with its own placeholder map
  const executeRun = async (textToSend: string, mapToRestore?: Record<string, string>) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading || input.length > 4000) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSelectedPastRun(null);

    // Assign a unique requestId for concurrency isolation
    const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
    if (mapToRestore && Object.keys(mapToRestore).length > 0) {
      placeholderMapsRef.current.set(reqId, mapToRestore);
    }

    try {
      const res = await fetch(`/api/apps/${app.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }

      const rawOutput = data?.output || '';

      // Retrieve this specific request's placeholder map and delete immediately from memory
      const requestMap = placeholderMapsRef.current.get(reqId);
      placeholderMapsRef.current.delete(reqId);

      // Restore placeholders in the AI response locally in the browser
      const finalOutput = requestMap ? restorePlaceholders(rawOutput, requestMap) : rawOutput;
      setOutput(finalOutput);

      // Refresh past runs to show new run row
      fetchPastRuns();
    } catch (err: any) {
      placeholderMapsRef.current.delete(reqId);
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mask and send action
  const handleMaskAndSend = () => {
    const { masked, map } = maskPrompt(input, findings);
    executeRun(masked, map);
  };

  // Send anyway action (after second confirmation)
  const handleSendAnywayConfirmed = () => {
    executeRun(input);
  };

  // Edit action
  const handleEdit = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Normal submit form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (findings.length > 0) {
      // If sensitive data was found, default form submit to safe "Mask and send"
      handleMaskAndSend();
    } else {
      executeRun(input);
    }
  };

  // Copy output to clipboard
  const handleCopy = async () => {
    const textToCopy = selectedPastRun ? selectedPastRun.output : output;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const activeOutput = selectedPastRun ? selectedPastRun.output : output;
  const activeInput = selectedPastRun ? selectedPastRun.input : input;

  return (
    <div className="space-y-6">
      {/* App Header */}
      <div className="promptos-panel rounded-2xl p-6 sm:p-7 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <h2 className="font-sans text-xl font-bold tracking-tight text-white">
                {app.name}
              </h2>
            </div>
            {app.description && (
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                {app.description}
              </p>
            )}
          </div>

          {selectedPastRun && (
            <button
              type="button"
              onClick={() => setSelectedPastRun(null)}
              className="text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer self-start sm:self-auto flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to New Run</span>
            </button>
          )}
        </div>

        {/* Selected Past Run Notice */}
        {selectedPastRun && (
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 text-zinc-300 font-mono">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>Viewing past run from {new Date(selectedPastRun.created_at).toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInput(selectedPastRun.input);
                setSelectedPastRun(null);
              }}
              className="text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer"
            >
              Load into Editor
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Run Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                {selectedPastRun ? 'Recorded Input' : 'Input'}
              </label>
              <span
                className={`text-[10px] font-mono ${
                  input.length > 4000 ? 'text-red-400 font-bold' : 'text-zinc-500'
                }`}
              >
                {selectedPastRun ? activeInput.length : input.length} / 4000
              </span>
            </div>
            <textarea
              ref={textareaRef}
              rows={5}
              value={selectedPastRun ? activeInput : input}
              onChange={(e) => {
                if (selectedPastRun) setSelectedPastRun(null);
                setInput(e.target.value);
              }}
              readOnly={!!selectedPastRun}
              placeholder="Enter your input for this mini-app..."
              className={`w-full bg-[#09090b] text-zinc-100 text-xs font-mono p-4 rounded-xl border transition-colors resize-none leading-relaxed focus:outline-none ${
                findings.length > 0 && !selectedPastRun
                  ? 'border-amber-500/70 focus:border-amber-400'
                  : 'border-zinc-800 focus:border-zinc-500'
              }`}
              required
            />
          </div>

          {/* 3. Warning banner showing detected categories and counts + actions */}
          {!selectedPastRun && findings.length > 0 && (
            <DlpBanner
              findings={findings}
              onMaskAndSend={handleMaskAndSend}
              onEdit={handleEdit}
              disabled={isLoading}
            />
          )}

          {/* Form Actions Footer (Preserved when no findings) */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-zinc-500">
              Maximum 4,000 characters
            </span>

            {/* If no findings, render standard Run button. If findings, button triggers Mask & Send */}
            <button
              type="submit"
              disabled={isLoading || !input.trim() || input.length > 4000}
              className={`px-6 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-150 flex items-center space-x-1.5 cursor-pointer ${
                isLoading || !input.trim() || input.length > 4000
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                  : findings.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-xs'
                  : 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-xs'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Running…</span>
                </>
              ) : findings.length > 0 ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Mask & Run</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Output Section */}
        {activeOutput && (
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Output
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#09090b] rounded-xl border border-zinc-800/80 p-4">
              <MarkdownOutput content={activeOutput} />
            </div>
          </div>
        )}
      </div>

      {/* Past Runs Section */}
      <div className="promptos-panel rounded-2xl p-6 sm:p-7 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h3 className="font-sans font-semibold text-xs text-white">
              Past Runs for this App
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {pastRuns.length} {pastRuns.length === 1 ? 'run' : 'runs'} recorded
          </span>
        </div>

        {isLoadingPastRuns ? (
          <div className="py-6 text-center text-xs text-zinc-500 font-mono">
            Loading past runs...
          </div>
        ) : pastRuns.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500 font-mono">
            No previous runs recorded for this mini-app yet.
          </div>
        ) : (
          <div className="space-y-2">
            {pastRuns.map((run) => {
              const isSelected = selectedPastRun?.id === run.id;
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedPastRun(run)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-600 text-white'
                      : 'bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] text-zinc-400">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                      View details
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-300 truncate">
                    <span className="text-zinc-500">Input:</span> {run.input}
                  </p>
                  <p className="text-xs font-mono text-zinc-400 truncate mt-0.5">
                    <span className="text-zinc-500">Output:</span> {run.output}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
