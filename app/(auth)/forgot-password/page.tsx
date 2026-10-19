'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });

      if (error && !error.message.includes('fetch')) {
        throw error;
      }

      setSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send recovery email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-[#0d0d10] border border-zinc-800 shadow-2xl">
      <div className="text-center mb-6">
        <h1 className="font-sans text-xl font-semibold tracking-tight text-white">
          Reset Password
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Enter your email to receive a password recovery link.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {sent ? (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 space-y-2 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
          <p className="font-semibold text-white">Recovery Link Dispatched</p>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            If an account exists for <strong className="text-zinc-200">{email}</strong>, you will receive password reset instructions.
          </p>
          <div className="pt-2">
            <a
              href="/login"
              className="inline-flex items-center space-x-1 text-xs font-mono text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleResetRequest} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
              Account Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <Button type="submit" variant="solid" size="lg" disabled={loading} className="w-full">
            {loading ? 'Sending link…' : 'Send Recovery Link'}
          </Button>

          <div className="text-center pt-2">
            <a
              href="/login"
              className="inline-flex items-center space-x-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to sign in</span>
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
