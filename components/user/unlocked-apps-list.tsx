'use client';

import React from 'react';
import { Terminal, ChevronRight, Lock } from 'lucide-react';
import type { SafeAppView } from './execution-container';

interface UnlockedAppsListProps {
  apps: SafeAppView[];
  selectedAppId: string;
  onSelectApp: (id: string) => void;
}

export const UnlockedAppsList: React.FC<UnlockedAppsListProps> = ({
  apps,
  selectedAppId,
  onSelectApp,
}) => {
  if (apps.length === 0) {
    return (
      <div className="promptos-panel rounded-2xl p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="font-sans font-semibold text-xs text-white">No Unlocked Mini-Apps</h3>
        <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
          You currently have no mini-apps assigned to your account. Visit a Creator's shared link (<code className="text-zinc-400 font-mono">/app/:slug</code>) to unlock tools.
        </p>
      </div>
    );
  }

  return (
    <div className="promptos-panel rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          Unlocked Tools ({apps.length})
        </span>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
          Active Tier
        </span>
      </div>

      <div className="space-y-1.5">
        {apps.map((app) => {
          const isSelected = selectedAppId === app.id;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => onSelectApp(app.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'bg-zinc-900 border-zinc-600 text-white shadow-xs'
                  : 'bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold text-xs truncate flex items-center space-x-1.5">
                  <Terminal className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
                  <span className="truncate">{app.name}</span>
                </div>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-normal">
                  {app.tagline}
                </p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-zinc-600'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
