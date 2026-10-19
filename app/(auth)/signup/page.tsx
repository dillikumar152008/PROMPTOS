import React, { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up | PromptOS',
  description: 'Create your PromptOS account to build single-purpose AI mini-apps or run tools.',
};

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="text-xs font-mono text-zinc-500">Loading auth card...</div>}>
      <AuthCard initialTab="signup" />
    </Suspense>
  );
}
