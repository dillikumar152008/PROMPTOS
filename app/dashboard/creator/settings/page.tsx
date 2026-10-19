import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, ShieldCheck, User } from 'lucide-react';

export default async function CreatorSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: any = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Creator';
  const email = user?.email || '';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-800">
        <h1 className="font-semibold text-xl tracking-tight text-white">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your account profile and view data processing disclosures.
        </p>
      </div>

      {/* Profile Card */}
      <div className="p-5 rounded-md border border-zinc-800 bg-[#09090b] space-y-4">
        <h2 className="text-sm font-medium text-white flex items-center space-x-2">
          <User className="w-4 h-4 text-zinc-400" />
          <span>Profile details</span>
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1">
              Display name (read-only)
            </label>
            <Input
              type="text"
              value={displayName}
              disabled
              className="bg-zinc-900 border-zinc-800 text-zinc-300 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1">
              Email address (read-only)
            </label>
            <Input
              type="email"
              value={email}
              disabled
              className="bg-zinc-900 border-zinc-800 text-zinc-300 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="pt-2">
          <form action="/api/auth/signout" method="post">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2 text-zinc-300 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out of all sessions</span>
            </Button>
          </form>
        </div>
      </div>

      {/* AI Data Processing Disclosure */}
      <div className="p-5 rounded-md border border-zinc-800 bg-[#09090b] space-y-3">
        <h2 className="text-sm font-medium text-white flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-zinc-400" />
          <span>AI processing disclosure</span>
        </h2>

        <p className="text-sm text-zinc-300 leading-relaxed">
          Prompts and inputs entered into your mini-apps are sent directly to the configured AI model provider (such as Google Gemini) to generate responses.
        </p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          PromptOS does not train models on your data or retain raw execution inputs beyond the runs recorded in your analytics dashboard.
        </p>
      </div>
    </div>
  );
}
