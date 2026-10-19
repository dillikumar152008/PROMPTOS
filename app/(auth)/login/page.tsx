import React, { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In | PromptOS',
  description: 'Sign in to access your PromptOS creator studio or user execution sandbox.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-xs font-mono text-zinc-500">Loading auth card...</div>}>
      <AuthCard initialTab="login" />
    </Suspense>
  );
}
