'use client';

import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Lock,
  Zap,
  FileText,
  Layers,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeatureItem {
  title: string;
  tag: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isUpcoming?: boolean;
}

export const MarketingFeaturesGrid: React.FC = () => {
  const features: FeatureItem[] = [
    // 6 Live Features
    {
      tag: 'Privacy',
      title: 'DLP Shield',
      description: 'Scans prompts on your device for Aadhaar, PAN, Indian mobile numbers, payment cards and API keys. Masks them before sending and restores them in the reply.',
      icon: ShieldCheck,
    },
    {
      tag: 'Productivity',
      title: 'Prompt Optimizer',
      description: 'One click turns a rough prompt into a structured one with role, task, constraints and output format.',
      icon: Sparkles,
    },
    {
      tag: 'OCR & Documents',
      title: 'Private document reading',
      description: 'Images and documents are read locally on your device with private OCR. Only sanitized extracted text is sent to the model.',
      icon: ImageIcon,
    },
    {
      tag: 'Workspace',
      title: 'Chat history & search',
      description: 'Every conversation is saved to Recents. Search past chats instantly.',
      icon: MessageSquare,
    },
    {
      tag: 'Security',
      title: 'Secure access',
      description: 'Invite-only accounts, authenticated sessions and row-level security on your data.',
      icon: Lock,
    },
    {
      tag: 'Speed',
      title: 'Fast responses',
      description: 'Powered by Gemini Flash with input and token limits for quick, stable replies.',
      icon: Zap,
    },
    // 3 Upcoming Features
    {
      tag: 'Documents',
      title: 'OCR & document reading',
      description: 'Extract text from scanned documents, photos and handwritten notes. Chat with the content, with DLP Shield applied to extracted text.',
      icon: FileText,
      isUpcoming: true,
    },
    {
      tag: 'Models',
      title: 'Multi-model tasking',
      description: 'Run one prompt across several AI models, compare answers side by side, or pick the best model per task.',
      icon: Layers,
      isUpcoming: true,
    },
    {
      tag: 'Efficiency',
      title: 'Smart model routing',
      description: 'Simple questions go to a fast, light model and complex ones to a stronger model, automatically.',
      icon: Cpu,
      isUpcoming: true,
    },
  ];

  return (
    <section id="features" className="py-16 md:py-20 border-b border-zinc-800 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Private, structured, and fast.
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Everything you need for safe AI interactions without leaking sensitive personal or corporate data.
          </p>
        </div>

        {/* 3 Columns x 3 Rows on Desktop, 1 Column on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, idx) => {
            const Icon = f.icon;

            if (f.isUpcoming) {
              return (
                <div
                  key={idx}
                  className="p-5 rounded-md border border-zinc-800/80 bg-[#09090b] flex flex-col justify-between select-none opacity-80"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <Badge variant="warning">Coming soon</Badge>
                    </div>

                    <div className="text-[11px] font-mono text-zinc-500 mb-1">
                      {f.tag}
                    </div>

                    <h3 className="font-sans font-medium text-sm text-zinc-200">
                      {f.title}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-2 line-clamp-2">
                      {f.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-zinc-800/60 flex items-center text-xs font-mono text-zinc-500">
                    <span>In development</span>
                  </div>
                </div>
              );
            }

            return (
              <a
                key={idx}
                href="/login"
                className="group p-5 rounded-md border border-zinc-800 bg-[#09090b] hover:bg-[#121215] hover:border-zinc-700 transition-colors duration-150 ease-out flex flex-col justify-between cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors duration-150 ease-out">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {f.tag}
                    </span>
                  </div>

                  <h3 className="font-sans font-medium text-sm text-white group-hover:text-zinc-100 transition-colors duration-150 ease-out">
                    {f.title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed mt-2 line-clamp-2">
                    {f.description}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors duration-150 ease-out">
                  <span>Open chat</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            );
          })}
        </div>

      </div>
    </section>
  );
};
