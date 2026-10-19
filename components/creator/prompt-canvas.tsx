'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, ArrowRight, Copy, Check, ExternalLink, RefreshCw, AlertCircle, TrendingDown, X, ShieldAlert } from 'lucide-react';

interface PromptCanvasProps {
  onAppCreated: (newApp: any) => void;
}

interface OptimizationResultData {
  optimizedPrompt: string;
  changes: string[];
  warning: string;
  tokensBefore: number;
  tokensAfter: number;
  savedTokens: number;
  savedPercent: number;
}

export const PromptCanvas: React.FC<PromptCanvasProps> = ({ onAppCreated }) => {
  // Idea input state
  const [idea, setIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSpec, setHasSpec] = useState(false);

  // Editable app specification state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [inputLabel, setInputLabel] = useState('Input');
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [accessMode, setAccessMode] = useState<'open' | 'invite_only' | 'paid'>('open');

  // Deploy state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedSlug, setDeployedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prompt Optimizer state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationData, setOptimizationData] = useState<OptimizationResultData | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // 1. Generate App Specification from Plain English Idea
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setDeployedSlug(null);

    try {
      const res = await fetch('/api/creator/generate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setName(data.name || '');
      setDescription(data.description || '');
      setSystemPrompt(data.systemPrompt || '');
      setInputLabel(data.inputLabel || 'Input');
      setInputPlaceholder(data.inputPlaceholder || 'Provide input...');
      setHasSpec(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Deploy App to Database
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim() || isDeploying) return;

    setIsDeploying(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          inputLabel: inputLabel.trim(),
          inputPlaceholder: inputPlaceholder.trim(),
          accessMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deploy app.');
      }

      setDeployedSlug(data.slug);
      onAppCreated(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Deployment error.');
    } finally {
      setIsDeploying(false);
    }
  };

  // 3. Optimize System Prompt
  const handleOptimizePrompt = async () => {
    if (!systemPrompt.trim() || isOptimizing) return;
    setIsOptimizing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/creator/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setOptimizationData(data);
      setShowComparison(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimization = () => {
    if (!optimizationData) return;
    setSystemPrompt(optimizationData.optimizedPrompt);
    setShowComparison(false);
    setOptimizationData(null);
  };

  const handleCancelOptimization = () => {
    setShowComparison(false);
    setOptimizationData(null);
  };

  // 4. Copy Share Link
  const getShareUrl = (slug: string) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && !siteUrl.includes('localhost')) {
      return `${siteUrl.replace(/\/$/, '')}/app/${slug}`;
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/app/${slug}`;
    }
    return `https://promptos.io/app/${slug}`;
  };

  const handleCopyLink = () => {
    if (!deployedSlug) return;
    const url = getShareUrl(deployedSlug);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setHasSpec(false);
    setDeployedSlug(null);
    setIdea('');
    setName('');
    setDescription('');
    setSystemPrompt('');
    setInputLabel('Input');
    setInputPlaceholder('');
    setErrorMsg(null);
    setShowComparison(false);
    setOptimizationData(null);
  };

  return (
    <div className="rounded-md border border-zinc-800 bg-[#09090b] p-5 sm:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {hasSpec ? 'Configure & Deploy Mini-App' : 'Build a Mini-App'}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {hasSpec 
              ? 'Review and fine-tune your tool before publishing.'
              : 'Describe what your tool does in plain English. The AI architect will draft the system prompt and inputs.'}
          </p>
        </div>

        {hasSpec && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Start fresh</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-md bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP A: Initial Plain English Prompt */}
      {!hasSpec ? (
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Describe your idea in plain English
            </label>
            <textarea
              rows={5}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. Build a tool for real estate agents that takes a rough property description and generates 3 high-converting MLS headline variations and 5 bullet points with neighborhood highlights..."
              maxLength={2000}
              required
              className="w-full bg-zinc-900 text-zinc-100 text-sm p-3.5 rounded-md border border-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] transition-colors duration-150 ease-out resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1">
              <span>Plain English description (max 2,000 characters)</span>
              <span>{idea.length} / 2,000</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={isGenerating || !idea.trim()}
              className="flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-zinc-400" />
              <span>{isGenerating ? 'Generating app…' : 'Generate app'}</span>
            </Button>
          </div>
        </form>
      ) : (
        /* STEP B: Editable Result Fields & Deployment */
        <form onSubmit={handleDeploy} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Name
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tool name"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Description
              </label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One sentence summary"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-zinc-300">
                  System prompt
                </label>
                <span className="text-[11px] text-zinc-500">Never exposed to end-users</span>
              </div>

              {/* Creator Optimize System Prompt Button */}
              <button
                type="button"
                onClick={handleOptimizePrompt}
                disabled={isOptimizing || !systemPrompt.trim()}
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/60 px-2.5 py-1 rounded transition-colors flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isOptimizing ? 'Optimizing prompt…' : 'Optimize system prompt'}</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="System prompt executing this mini-app"
              required
              className="w-full bg-zinc-900 text-zinc-100 text-sm font-mono p-3 rounded-md border border-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] transition-colors duration-150 ease-out resize-none leading-relaxed"
            />
          </div>

          {/* Side-by-Side Optimization Comparison Panel */}
          {showComparison && optimizationData && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4 sm:p-5 space-y-4 my-2">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">
                    System Prompt Optimization Comparison
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelOptimization}
                  className="text-zinc-400 hover:text-zinc-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Token Metrics summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-[#09090b] p-2.5 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Before (estimated)</span>
                  <span className="text-xs font-medium text-zinc-200">{optimizationData.tokensBefore} tokens</span>
                </div>
                <div className="bg-[#09090b] p-2.5 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">After (estimated)</span>
                  <span className="text-xs font-medium text-zinc-200">{optimizationData.tokensAfter} tokens</span>
                </div>
                <div className="bg-[#09090b] p-2.5 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Saved Tokens</span>
                  <span className="text-xs font-medium text-emerald-400">-{optimizationData.savedTokens} tokens</span>
                </div>
                <div className="bg-[#09090b] p-2.5 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Efficiency</span>
                  <span className="text-xs font-medium text-emerald-400">{optimizationData.savedPercent}% reduction</span>
                </div>
              </div>

              {/* Side-by-side prompt views */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>Original Prompt</span>
                    <span className="text-[10px] text-zinc-500">{optimizationData.tokensBefore} tokens (estimated)</span>
                  </div>
                  <div className="w-full bg-zinc-950/80 p-3 rounded border border-zinc-800 text-xs font-mono text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {systemPrompt}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-emerald-300">
                    <span>Optimized Prompt</span>
                    <span className="text-[10px] text-emerald-400">{optimizationData.tokensAfter} tokens (estimated)</span>
                  </div>
                  <div className="w-full bg-zinc-950/80 p-3 rounded border border-emerald-900/60 text-xs font-mono text-emerald-100 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {optimizationData.optimizedPrompt}
                  </div>
                </div>
              </div>

              {/* Changes Made */}
              {optimizationData.changes.length > 0 && (
                <div className="text-xs font-mono space-y-1">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Changes Made:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-300 text-[11px]">
                    {optimizationData.changes.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {optimizationData.warning && optimizationData.warning.toLowerCase() !== 'none' && (
                <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/50 text-[11px] font-mono text-amber-300 flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Warning:</span>
                    <span>{optimizationData.warning}</span>
                  </div>
                </div>
              )}

              {/* Confirmation Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-emerald-900/30">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelOptimization}
                >
                  Keep Original
                </Button>
                <Button
                  type="button"
                  variant="solid"
                  size="sm"
                  onClick={handleApplyOptimization}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  <span>Apply to System Prompt</span>
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Input label
              </label>
              <Input
                type="text"
                value={inputLabel}
                onChange={(e) => setInputLabel(e.target.value)}
                placeholder="e.g. Property Notes"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Input placeholder
              </label>
              <Input
                type="text"
                value={inputPlaceholder}
                onChange={(e) => setInputPlaceholder(e.target.value)}
                placeholder="e.g. 3 bed 2 bath Victorian in Austin..."
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1">
              Access mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['open', 'invite_only', 'paid'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAccessMode(mode)}
                  className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                    accessMode === mode
                      ? 'border-[#2563eb] bg-[#2563eb]/10 text-white'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-semibold capitalize">{mode.replace('_', ' ')}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {mode === 'open' && 'Anyone with link'}
                    {mode === 'invite_only' && 'Requires approval'}
                    {mode === 'paid' && 'Paywall pass'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={isDeploying || !name.trim() || !systemPrompt.trim()}
              className="flex items-center space-x-2"
            >
              <span>{isDeploying ? 'Deploying to network…' : 'Deploy mini-app'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      )}

      {/* STEP C: Deployed Success State */}
      {deployedSlug && (
        <div className="p-4 rounded-md border border-zinc-700 bg-zinc-900/80 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-white">App Deployed & Live</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={getShareUrl(deployedSlug)}
              className="flex-1 bg-black text-xs font-mono text-zinc-300 p-2.5 rounded border border-zinc-800 focus:outline-none"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              className="flex items-center space-x-1 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </Button>
            <a
              href={`/app/${deployedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

    </div>
  );
};
