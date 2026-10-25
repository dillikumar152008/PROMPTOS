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
  const countText = summary.map((s) => `${s.label} (${s.count})`).join(', ');

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3.5 py-3 text-xs animate-in fade-in duration-150">
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + summary */}
        <div className="flex items-start gap-2 min-w-0">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-amber-200 font-medium">Sensitive data detected — </span>
            <span className="text-amber-300/80">{countText}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={onEdit}
            className="text-[#9b9b9b] hover:text-[#ececec] transition-colors cursor-pointer disabled:opacity-40 text-xs"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onMaskAndSend}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-40"
          >
            <ShieldCheck className="w-3 h-3" />
            Mask &amp; send
          </button>
        </div>
      </div>
    </div>
  );
};
