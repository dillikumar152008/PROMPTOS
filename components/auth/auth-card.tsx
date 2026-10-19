'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { isValidRole, getRoleDashboard, isAllowedPathForRole, type Role } from '@/lib/auth/roles';
import { Code2, User, AlertCircle, ArrowRight } from 'lucide-react';

interface AuthCardProps {
  initialTab?: 'login' | 'signup';
}

export const AuthCard: React.FC<AuthCardProps> = ({ initialTab = 'login' }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL Query Parameters
  const roleParam = searchParams.get('role');
  const fromParam = searchParams.get('from');
  const nextParam = searchParams.get('next');

  // Form State
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);
  const [role, setRole] = useState<Role>(isValidRole(roleParam) ? roleParam : 'creator');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync tab with props if prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Preselect role from ?role= parameter
  useEffect(() => {
    if (isValidRole(roleParam)) {
      setRole(roleParam);
    }
  }, [roleParam]);

  // Contextual one-line plain-language hint based on ?from=
  const getContextualHint = () => {
    if (!fromParam) return null;
    const hints: Record<string, string> = {
      'plain-english-builder': 'Sign up as a Creator to build mini-apps in plain English.',
      'one-click-deploy': 'Sign up as a Creator to deploy mini-apps with unique shareable links.',
      'single-purpose-apps': 'Sign up as a User to run single-purpose mini-apps.',
      'usage-analytics': 'Sign up as a Creator to monitor mini-app analytics.',
      'pay-per-app': 'Sign up as a User to unlock pay-per-app access.',
      'role-separated-workspaces': 'Sign up to access your role-separated workspace.',
      'how-describe': 'Sign up as a Creator to describe your first mini-app.',
      'how-deploy': 'Sign up as a Creator to deploy your first mini-app.',
      'how-share': 'Sign up as a Creator to share your mini-app.',
      'pricing-starter': 'Sign up as a Creator to start building on the free plan.',
      'pricing-pro': 'Join the waiting list for the Pro Studio tier.',
      'pricing-team': 'Join the waiting list for the Team tier.',
      'bottom-cta': 'Sign up to get started with PromptOS.',
    };

    return hints[fromParam] || `Sign up to continue to ${fromParam.replace(/-/g, ' ')}.`;
  };

  // Inline Password Validation
  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (activeTab === 'signup') {
      if (val.length > 0 && val.length < 8) {
        setPasswordError('Password must be at least 8 characters long');
      } else {
        setPasswordError('');
      }
    } else {
      setPasswordError('');
    }
  };

  // Calculate redirect destination
  const getResolvedDestination = (assignedRole: Role): string => {
    if (nextParam && isAllowedPathForRole(assignedRole, nextParam)) {
      return nextParam;
    }
    return getRoleDashboard(assignedRole);
  };

  // Map Supabase / network errors to plain human-readable messages
  const humanizeError = (err: any): string => {
    const msg: string = err?.message || '';

    // Sign ups closed
    if (
      msg.toLowerCase().includes('sign ups are currently closed') ||
      msg.toLowerCase().includes('database error saving new user')
    ) {
      return 'Failed to create account. Sign ups are currently closed.';
    }

    // Wrong credentials
    if (
      msg.toLowerCase().includes('invalid login credentials') ||
      msg.toLowerCase().includes('invalid credentials')
    ) {
      return 'Incorrect email or password.';
    }

    // Email not confirmed
    if (msg.toLowerCase().includes('email not confirmed')) {
      return 'Please confirm your email first.';
    }

    // Network / fetch errors
    if (
      msg.toLowerCase().includes('failed to fetch') ||
      msg.toLowerCase().includes('networkerror') ||
      msg.toLowerCase().includes('fetch') ||
      msg.toLowerCase().includes('network')
    ) {
      return 'Cannot reach the server. Try again.';
    }

    // Already registered (signup)
    if (
      msg.toLowerCase().includes('user already registered') ||
      msg.toLowerCase().includes('already registered') ||
      msg.toLowerCase().includes('email already in use')
    ) {
      return 'An account with this email already exists. Try logging in instead.';
    }

    // Short generic message for anything else (never raw technical errors)
    return 'Authentication failed. Please try again.';
  };

  // Submit Handler: Real Supabase Auth Only
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (activeTab === 'signup' && password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (err: any) {
      setErrorMsg(humanizeError(err));
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // Fetch authoritative role strictly from app_metadata or profiles
        let assignedRole: Role | null = data.user?.app_metadata?.role as Role | null;
        if (!assignedRole) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();
          if (profile && isValidRole(profile.role)) {
            assignedRole = profile.role;
          }
        }

        const finalRole: Role = assignedRole || 'user';
        const dest = getResolvedDestination(finalRole);
        router.push(dest);
        router.refresh();

      } else {
        // Sign Up with chosen role stored in metadata for server trigger to record
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
          },
        });

        if (error) {
          throw error;
        }

        const dest = getResolvedDestination(role);
        router.push(dest);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(humanizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-md bg-[#09090b] border border-zinc-800">
      
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-8 h-8 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-xs mx-auto mb-3 select-none">
          &gt;_
        </div>
        <h1 className="font-sans text-xl font-semibold tracking-tight text-white">
          {activeTab === 'login' ? 'Welcome back to PromptOS' : 'Create your PromptOS account'}
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          {activeTab === 'login'
            ? 'Sign in to your account.'
            : 'Build or execute single-purpose AI mini-apps'}
        </p>

        {/* Contextual Plain-Language Hint based on ?from= (Only shown on Sign Up tab when ?from= is present) */}
        {activeTab === 'signup' && getContextualHint() && (
          <div className="mt-3 p-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 text-left">
            {getContextualHint()}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'login', label: 'Log In' },
          { id: 'signup', label: 'Sign Up' },
        ]}
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab as 'login' | 'signup');
          setErrorMsg(null);
          setPasswordError('');
        }}
        className="mb-5"
      />

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-md bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Full name (Sign Up only) */}
        {activeTab === 'signup' && (
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-1.5">
              Full name
            </label>
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Elena Vance"
              required
            />
          </div>
        )}

        {/* Email */}
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-1.5">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-zinc-300">
              Password
            </label>
            {activeTab === 'login' && (
              <a
                href="/forgot-password"
                className="text-xs text-zinc-400 hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
              >
                Forgot password?
              </a>
            )}
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder={activeTab === 'signup' ? 'Minimum 8 characters' : 'Enter your password'}
            error={passwordError}
            required
          />
        </div>

        {/* Role Options: described in one short line each (Sign Up only) */}
        {activeTab === 'signup' && (
          <div className="pt-2">
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Select your role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('creator')}
                className={`p-3 rounded-md border text-left transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                  role === 'creator'
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-[#09090b] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-medium text-sm text-white">
                  <Code2 className="w-4 h-4 text-zinc-400" />
                  <span>Creator</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-snug">
                  Build and deploy single-purpose AI mini-apps
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('user')}
                className={`p-3 rounded-md border text-left transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                  role === 'user'
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-[#09090b] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-medium text-sm text-white">
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>User</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-snug">
                  Run unlocked mini-apps in a clean environment
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          variant="solid"
          size="lg"
          disabled={loading || !!passwordError}
          className="w-full mt-3"
        >
          {loading ? (
            <span>Processing…</span>
          ) : activeTab === 'login' ? (
            <span className="flex items-center space-x-1.5">
              <span>Sign in</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          ) : (
            <span className="flex items-center space-x-1.5">
              <span>Create {role === 'creator' ? 'Creator' : 'User'} account</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>

      </form>

      {/* Switch Tab Prompt */}
      <div className="mt-6 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-400">
        {activeTab === 'login' ? (
          <span>
            Don't have an account yet?{' '}
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMsg(null);
              }}
              className="text-white font-medium hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
            >
              Sign up
            </button>
          </span>
        ) : (
          <span>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
              }}
              className="text-white font-medium hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
            >
              Log in
            </button>
          </span>
        )}
      </div>

    </div>
  );
};
