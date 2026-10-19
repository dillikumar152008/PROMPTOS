'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExecutionContainer, type SafeAppView } from '@/components/user/execution-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, ArrowRight, ShieldCheck, Share2, Check, AlertCircle } from 'lucide-react';

interface AppRecord extends SafeAppView {
  creator_name?: string;
  access_mode?: string;
  price?: string;
}

export default function PublicAppRunnerPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const slug = params.slug;

  const [app, setApp] = useState<AppRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    async function loadAppAndAccess() {
      try {
        setIsLoading(true);
        // 1. Fetch app strictly from safe view via API (Never derive title from slug!)
        const appRes = await fetch(`/api/apps?slug=${encodeURIComponent(slug)}`);
        if (!appRes.ok) {
          setNotFound(true);
          return;
        }

        const appData = await appRes.json();
        if (!appData || !appData.id) {
          setNotFound(true);
          return;
        }

        setApp({
          id: appData.id,
          name: appData.name,
          tagline: appData.description || appData.tagline || 'Single-purpose AI mini-app.',
          slug: appData.slug,
          input_placeholder: appData.input_placeholder || 'Provide input...',
          creator_name: appData.creator_name || 'PromptOS Creator',
          access_mode: appData.access_mode || 'open',
          price: appData.access_mode === 'paid' ? '$0.00 (Beta Access)' : 'Free',
        });

        // 2. Check access in database (No localStorage!)
        const accessRes = await fetch(`/api/apps/${appData.id}/access`);
        if (accessRes.ok) {
          const accessData = await accessRes.json();
          if (accessData.hasAccess) {
            setHasAccess(true);
          }
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadAppAndAccess();
  }, [slug]);

  // Handle claiming access pass in Supabase app_access table
  const handleClaimUnlock = async () => {
    if (!app) return;
    setIsUnlocking(true);
    setUnlockError(null);

    try {
      const res = await fetch(`/api/apps/${app.id}/access`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=/app/${encodeURIComponent(slug)}`);
          return;
        }
        throw new Error(data.error || 'Failed to claim access pass.');
      }

      setHasAccess(true);
    } catch (err: any) {
      setUnlockError(err.message || 'Could not unlock app.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleCopyLink = () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const url = `${baseUrl}/app/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center font-mono text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
          <span>Loading mini-app…</span>
        </div>
      </div>
    );
  }

  if (notFound || !app) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="font-sans text-xl font-bold tracking-tight text-white mb-2">
          Mini-App Not Found
        </h1>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
          The requested mini-app does not exist or has been removed by its creator. Please check the URL and try again.
        </p>
        <a
          href="/"
          className="text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl transition-colors"
        >
          Return Home
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center space-x-2 group">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs shadow-xs group-hover:bg-white transition-colors">
              &gt;_
            </div>
            <span className="font-sans font-bold text-sm tracking-tight text-white">
              PromptOS
            </span>
          </a>

          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs font-mono"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied Link' : 'Share Tool'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10">
        
        {hasAccess ? (
          /* Active Execution View */
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-500 mb-2">
              <span className="text-emerald-400">● Unlocked</span>
              <span>&bull;</span>
              <span>Author: {app.creator_name}</span>
            </div>
            <ExecutionContainer app={app} />
          </div>
        ) : (
          /* Unlock Screen (Access Claim Step) */
          <div className="promptos-panel rounded-2xl p-8 sm:p-12 border border-zinc-800 text-center max-w-xl mx-auto space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <Badge variant="secondary" className="mb-2">Access Required</Badge>
              <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
                {app.name}
              </h1>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-md mx-auto">
                {app.tagline}
              </p>
            </div>

            {unlockError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                {unlockError}
              </div>
            )}

            {/* Access Details */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-zinc-400">Creator:</span>
                <span className="text-zinc-200">{app.creator_name}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-zinc-400">Access Mode:</span>
                <span className="text-zinc-200 capitalize font-mono">{app.access_mode}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-zinc-400">Fee:</span>
                <span className="text-emerald-400 font-bold">{app.price}</span>
              </div>
            </div>

            {/* Claim Access Button */}
            {app.access_mode === 'invite_only' ? (
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-300">
                This mini-app is invite-only. Please request access from the creator.
              </div>
            ) : (
              <Button
                variant="solid"
                size="lg"
                onClick={handleClaimUnlock}
                disabled={isUnlocking}
                className="w-full"
              >
                {isUnlocking ? (
                  <span>Unlocking Access…</span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <span>Claim Access Pass</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            )}

            <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Instant access pass &bull; Secured by PromptOS</span>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
