'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Copy, Check, FileText } from 'lucide-react';

interface MarkdownOutputProps {
  content: string;
  stats?: {
    latencyMs: number;
    tokensUsed: number;
  };
}

export const MarkdownOutput: React.FC<MarkdownOutputProps> = ({ content, stats }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-zinc-300">
          <FileText className="w-4 h-4 text-zinc-400" />
          <span>Output Stream</span>
        </div>

        {content && (
          <div className="flex items-center space-x-3">
            {stats && (
              <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                {stats.latencyMs}ms &bull; ~{stats.tokensUsed} tokens
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="text-xs font-mono flex items-center space-x-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy to clipboard'}</span>
            </Button>
          </div>
        )}
      </div>

      <div className="bg-[#09090b] rounded-xl border border-zinc-800 p-4 sm:p-5 min-h-[220px]">
        {content ? (
          <div className="prose prose-invert max-w-none text-xs font-mono text-zinc-200 leading-relaxed space-y-3">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-center text-zinc-600 space-y-1">
            <p className="text-xs font-mono">No execution output yet.</p>
            <p className="text-[11px] text-zinc-600">
              Supply input context above and click Run to stream results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
