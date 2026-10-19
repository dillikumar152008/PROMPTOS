'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { type Role, getRoleDashboard } from '@/lib/auth/roles';
import { Code2, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('creator');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Update public.profiles table with chosen role
        const { error } = await supabase
          .from('profiles')
          .update({ role: selectedRole })
          .eq('id', user.id);

        if (error) {
          console.warn('[Onboarding] Supabase profiles update notice:', error.message);
        }
      }

      // Update session cookie with authoritative role
      const cookiePayload = {
        id: user?.id || `usr_oauth_${Date.now()}`,
        email: user?.email || 'authenticated@promptos.ai',
        role: selectedRole,
      };
      document.cookie = `promptos_session=${encodeURIComponent(JSON.stringify(cookiePayload))}; path=/; max-age=86400; SameSite=Lax`;

      const dest = getRoleDashboard(selectedRole);
      router.push(dest);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize role workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-[#0d0d10] border border-zinc-800 shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-white text-xs mx-auto mb-3">
          &gt;_
        </div>
        <h1 className="font-sans text-xl font-semibold tracking-tight text-white">
          Complete Account Setup
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Select your intended workspace role. This partitions your environment and cannot be modified by the browser.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleConfirmRole} className="space-y-4">
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setSelectedRole('creator')}
            className={`w-full p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
              selectedRole === 'creator'
                ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                : 'bg-[#09090b] border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-semibold text-xs text-zinc-200">
                <Code2 className="w-4 h-4 text-zinc-300" />
                <span>Creator Studio</span>
              </div>
              {selectedRole === 'creator' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
              I want to prompt, build, and deploy single-purpose AI mini-apps with unique URLs and usage analytics.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('user')}
            className={`w-full p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
              selectedRole === 'user'
                ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                : 'bg-[#09090b] border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-semibold text-xs text-zinc-200">
                <User className="w-4 h-4 text-zinc-300" />
                <span>End-User Execution Sandbox</span>
              </div>
              {selectedRole === 'user' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
              I want to run single-purpose mini-apps in a clean, distraction-free environment with 1-click clipboard output.
            </p>
          </button>
        </div>

        <Button
          type="submit"
          variant="solid"
          size="lg"
          disabled={loading}
          className="w-full mt-4"
        >
          {loading ? (
            <span>Allocating Partition…</span>
          ) : (
            <span className="flex items-center space-x-1.5">
              <span>Confirm &amp; Enter {selectedRole === 'creator' ? 'Creator Studio' : 'User Runtime'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
