'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, Sparkles } from 'lucide-react';
import type { AppFormData } from '@/types/app';

interface CreatorAppFormProps {
  initialData?: AppFormData;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (formData: AppFormData) => Promise<void>;
  title: string;
  subtitle: string;
}

export const CreatorAppForm: React.FC<CreatorAppFormProps> = ({
  initialData,
  submitLabel,
  isSubmitting,
  errorMessage,
  onSubmit,
  title,
  subtitle,
}) => {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [instructions, setInstructions] = useState(initialData?.instructions || '');
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const trimmedInst = instructions.trim();

    if (!trimmedName) {
      setClientError('App name is required.');
      return;
    }
    if (!trimmedDesc) {
      setClientError('App description is required.');
      return;
    }
    if (!trimmedInst) {
      setClientError('Instructions are required.');
      return;
    }

    await onSubmit({
      name: trimmedName,
      description: trimmedDesc,
      instructions: trimmedInst,
    });
  };

  const activeError = errorMessage || clientError;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => router.push('/dashboard/creator')}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
          aria-label="Back to apps list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">{title}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Error Alert */}
      {activeError && (
        <div 
          className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start space-x-2.5 animate-in fade-in"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span className="leading-relaxed">{activeError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-800 bg-[#09090b] p-6">
        <div>
          <label htmlFor="app-name" className="text-xs font-medium text-zinc-300 block mb-1.5">
            App Name
          </label>
          <input
            id="app-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cold Email Generator"
            required
            maxLength={100}
            disabled={isSubmitting}
            className="w-full bg-zinc-900 text-zinc-100 text-sm p-3 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="app-description" className="text-xs font-medium text-zinc-300 block mb-1.5">
            Description
          </label>
          <input
            id="app-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Generates high-converting personalized sales outreach"
            required
            maxLength={300}
            disabled={isSubmitting}
            className="w-full bg-zinc-900 text-zinc-100 text-sm p-3 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600 disabled:opacity-50"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="app-instructions" className="text-xs font-medium text-zinc-300">
              Instructions (plain English)
            </label>
            <span className="text-[11px] font-mono text-zinc-500">
              {instructions.length} chars
            </span>
          </div>
          <textarea
            id="app-instructions"
            rows={8}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Write clear, plain-English instructions guiding how this mini-app processes user input and structures its output..."
            required
            disabled={isSubmitting}
            className="w-full bg-zinc-900 text-zinc-100 text-xs font-mono p-3.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600 resize-none leading-relaxed disabled:opacity-50"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => router.push('/dashboard/creator')}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !description.trim() || !instructions.trim()}
            className="px-5 py-2 rounded-lg text-xs font-medium text-black bg-white hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer font-sans"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
