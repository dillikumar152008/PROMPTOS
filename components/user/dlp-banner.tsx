'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { summarize, LABELS, type Finding } from '@/src/lib/dlp';

interface DlpBannerProps {
  findings: Finding[];
  onMaskAndSend: () => void;
  onEdit: () => void;
  disabled?: boolean;
}

export const DlpBanner: React.FC<DlpBannerProps> = ({
  findings,
  onMaskAndSend,
  onEdit,
  disabled = false,
}) => {
  if (!findings || findings.length === 0) return null;

  const summary = summarize(findings);
  const summaryText = `Sensitive data found: ${summary
    .map((s) => `${s.label} x${s.count}`)
    .join(', ')}`;

  return (
    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/50 text-xs space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-amber-300 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">{summaryText}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 bg-amber-900/40 border border-amber-700/50 px-2 py-0.5 rounded">
          DLP Shield Active
        </span>
      </div>

      {/* Detected values highlights */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {findings.map((f, i) => (
          <span
            key={`${f.type}-${f.start}-${i}`}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-900/40 border border-amber-600/40 text-amber-200 font-mono text-[11px]"
          >
            <span className="text-amber-400/80 font-semibold">{LABELS[f.type] || f.type}:</span>
            <span className="font-medium underline decoration-amber-500/50">{f.value}</span>
          </span>
        ))}
      </div>

      {/* Action buttons: Mask and send + Edit only */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-800/40">
        <button
          type="button"
          disabled={disabled}
          onClick={onMaskAndSend}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Mask and send</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-mono text-xs transition-colors cursor-pointer"
        >
          Edit
        </button>
      </div>
    </div>
  );
};
