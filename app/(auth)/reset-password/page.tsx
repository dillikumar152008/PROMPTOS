'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error && !error.message.includes('fetch')) {
        throw error;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-[#0d0d10] border border-zinc-800 shadow-2xl">
      <div className="text-center mb-6">
        <h1 className="font-sans text-xl font-semibold tracking-tight text-white">
          Choose New Password
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Set a secure password of at least 8 characters.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {success ? (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 space-y-2 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
          <p className="font-semibold text-white">Password Updated Successfully</p>
          <p className="text-zinc-400 text-[11px]">
            Redirecting to sign in...
          </p>
        </div>
      ) : (
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
              New Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
              Confirm Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </div>

          <Button type="submit" variant="solid" size="lg" disabled={loading} className="w-full mt-2">
            {loading ? 'Updating…' : 'Update Password & Sign In'}
          </Button>
        </form>
      )}
    </div>
  );
}
