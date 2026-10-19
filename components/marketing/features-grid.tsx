import React from 'react';
import { Terminal, Link2, Lock, BarChart3, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const MarketingFeaturesGrid: React.FC = () => {
  const features = [
    {
      title: 'Describe it in plain English',
      description: 'Define input fields, system behavior, and formatting instructions in conversational English.',
      href: '/signup?role=creator&from=plain-english-builder',
      icon: Terminal,
      targetRole: 'Creator',
      badge: null,
    },
    {
      title: 'One-click deploy with a unique link',
      description: 'Generate an unguessable share link with rate limits and protected instructions.',
      href: '/signup?role=creator&from=one-click-deploy',
      icon: Link2,
      targetRole: 'Creator',
      badge: null,
    },
    {
      title: 'Single-purpose mini-apps',
      description: 'End-users interact with focused tools without prompt complexity or system prompt leakage.',
      href: '/signup?role=user&from=single-purpose-apps',
      icon: Lock,
      targetRole: 'User',
      badge: null,
    },
    {
      title: 'Usage and token analytics',
      description: 'Audit execution volume, latency numbers, and token consumption in tabular views.',
      href: '/signup?role=creator&from=usage-analytics',
      icon: BarChart3,
      targetRole: 'Creator',
      badge: null,
    },
    {
      title: 'Pay-per-app access',
      description: 'Unlock individual tools on demand. Creator monetization infrastructure.',
      href: '/signup?role=user&from=pay-per-app',
      icon: CreditCard,
      targetRole: 'User',
      badge: 'Coming soon',
    },
    {
      title: 'Role-separated workspaces',
      description: 'Strict route isolation keeps creator authoring and user execution completely separate.',
      href: '/signup?role=creator&from=role-separated-workspaces',
      icon: ShieldCheck,
      targetRole: 'Creator',
      badge: null,
    },
  ];

  return (
    <section id="features" className="py-16 md:py-20 border-b border-zinc-800 bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Engineered for precision. Built for human utility.
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Every feature cell connects directly to an isolated workspace tailored to your intent.
          </p>
        </div>

        {/* 6 Compact Bordered Cells */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <a
                key={idx}
                href={f.href}
                className="group p-4 rounded-md border border-zinc-800 bg-[#09090b] hover:bg-[#121215] hover:border-zinc-700 transition-colors duration-150 ease-out flex flex-col justify-between cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors duration-150 ease-out">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {f.badge ? (
                      <Badge variant="warning">{f.badge}</Badge>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-400">
                        {f.targetRole}
                      </span>
                    )}
                  </div>

                  <h3 className="font-sans font-medium text-sm text-white group-hover:text-zinc-100 transition-colors duration-150 ease-out">
                    {f.title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed mt-1.5 font-normal">
                    {f.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors duration-150 ease-out">
                  <span>Enter as {f.targetRole}</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>
            );
          })}
        </div>

      </div>
    </section>
  );
};
