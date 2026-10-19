'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CreatorAppForm } from '@/components/creator/creator-app-form';
import type { App, AppFormData } from '@/types/app';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function EditCreatorAppPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const appId = params.id;

  const [app, setApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadApp() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          setErrorMessage('Authentication required. Please sign in.');
          return;
        }

        const { data, error } = await supabase
          .from('apps')
          .select('id, creator_id, name, description, instructions, status, created_at, updated_at')
          .eq('id', appId)
          .eq('creator_id', user.id)
          .single();

        if (error || !data) {
          setErrorMessage(error?.message || 'App not found or you do not have permission to edit it.');
          return;
        }

        setApp(data as App);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load app.');
      } finally {
        setIsLoading(false);
      }
    }

    loadApp();
  }, [appId]);

  const handleUpdateApp = async (formData: AppFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setErrorMessage('Authentication required. Please sign in.');
        return;
      }

      // Update name, description, instructions (do not send updated_at; trigger sets it)
      const { data, error } = await supabase
        .from('apps')
        .update({
          name: formData.name,
          description: formData.description,
          instructions: formData.instructions,
        })
        .eq('id', appId)
        .eq('creator_id', user.id)
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message || 'Failed to update app.');
        return;
      }

      router.push('/dashboard/creator');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong while updating the app.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-zinc-800 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-zinc-900" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-zinc-900" />
            <div className="h-3 w-64 rounded bg-zinc-900" />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#09090b] p-6 space-y-5 animate-pulse">
          <div className="h-10 rounded-lg bg-zinc-900" />
          <div className="h-10 rounded-lg bg-zinc-900" />
          <div className="h-40 rounded-lg bg-zinc-900" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-12">
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center justify-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage || 'App not found.'}</span>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/creator')}
          className="inline-flex items-center space-x-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <CreatorAppForm
      title="Edit App"
      subtitle={`Editing ${app.name}`}
      submitLabel="Save Changes"
      initialData={{
        name: app.name,
        description: app.description,
        instructions: app.instructions,
      }}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onSubmit={handleUpdateApp}
    />
  );
}
