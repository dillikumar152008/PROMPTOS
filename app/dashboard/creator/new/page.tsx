'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CreatorAppForm } from '@/components/creator/creator-app-form';
import type { AppFormData } from '@/types/app';

export default function NewCreatorAppPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateApp = async (formData: AppFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setErrorMessage('Authentication required. Please sign in again.');
        return;
      }

      // Insert with creator_id = auth user id, status defaults to 'draft'
      const { data, error } = await supabase
        .from('apps')
        .insert({
          creator_id: user.id,
          name: formData.name,
          description: formData.description,
          instructions: formData.instructions,
        })
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message || 'Failed to create app.');
        return;
      }

      router.push('/dashboard/creator');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong while creating the app.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CreatorAppForm
      title="Create New App"
      subtitle="Define your tool name, description, and plain-English instructions."
      submitLabel="Create App"
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onSubmit={handleCreateApp}
    />
  );
}
