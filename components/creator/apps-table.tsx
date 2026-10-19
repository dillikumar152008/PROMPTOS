'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, Pause, Play, Trash2, AlertTriangle } from 'lucide-react';

export interface CreatorMiniApp {
  id: string;
  name: string;
  description: string;
  slug: string;
  input_label?: string;
  input_placeholder?: string;
  access_mode?: string;
  status: 'active' | 'paused' | string;
  runsCount: number;
  tokensUsed: string;
  createdAt: string;
}

interface AppsTableProps {
  apps: CreatorMiniApp[];
  onDeleteApp: (id: string) => void;
  onToggleStatus: (id: string, newStatus: 'active' | 'paused') => void;
}

export const AppsTable: React.FC<AppsTableProps> = ({
  apps,
  onDeleteApp,
  onToggleStatus,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  const getShareUrl = (slug: string) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && !siteUrl.includes('localhost')) {
      return `${siteUrl.replace(/\/$/, '')}/app/${slug}`;
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/app/${slug}`;
    }
    return `https://promptos.io/app/${slug}`;
  };

  const handleCopyLink = (app: CreatorMiniApp) => {
    const url = getShareUrl(app.slug);
    navigator.clipboard.writeText(url);
    setCopiedId(app.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/apps/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete app.');
      }
      onDeleteApp(id);
      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete app.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggle = async (app: CreatorMiniApp) => {
    const nextStatus: 'active' | 'paused' = app.status === 'paused' ? 'active' : 'paused';
    setIsTogglingId(app.id);
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update app status.');
      }
      onToggleStatus(app.id, nextStatus);
    } catch (err: any) {
      alert(err.message || 'Status update failed.');
    } finally {
      setIsTogglingId(null);
    }
  };

  if (apps.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800 bg-[#09090b] p-8 text-center text-sm text-zinc-400">
        You haven't built any mini-apps yet. Describe an idea above to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-[#09090b] overflow-hidden">
      
      <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Your mini-apps ({apps.length})
        </h3>
        <span className="text-xs text-zinc-400">
          Real database records
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400">
              <th className="py-2.5 px-4">Name</th>
              <th className="py-2.5 px-3">Link</th>
              <th className="py-2.5 px-3">Access</th>
              <th className="py-2.5 px-3 text-right">Runs</th>
              <th className="py-2.5 px-3 text-right">Tokens</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
            {apps.map((app) => (
              <tr key={app.id} className="hover:bg-zinc-900/40 transition-colors duration-150 ease-out">
                
                {/* Name & Description */}
                <td className="py-3 px-4 max-w-xs">
                  <div className="font-medium text-white truncate">
                    {app.name}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    {app.description}
                  </div>
                </td>

                {/* Share Link */}
                <td className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(app)}
                    className="inline-flex items-center space-x-1 font-mono text-xs text-zinc-300 hover:text-white transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
                    title="Click to copy link"
                  >
                    <span>/app/{app.slug.slice(0, 16)}…</span>
                    {copiedId === app.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    )}
                  </button>
                </td>

                {/* Access mode */}
                <td className="py-3 px-3">
                  <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                    app.access_mode === 'paid'
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                      : app.access_mode === 'invite_only'
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}>
                    {app.access_mode === 'open' ? 'Open link' : app.access_mode === 'invite_only' ? 'Invite-only' : 'Paid'}
                  </span>
                </td>

                {/* Runs */}
                <td className="py-3 px-3 text-right tabular-nums text-white">
                  {(app.runsCount || 0).toLocaleString()}
                </td>

                {/* Tokens */}
                <td className="py-3 px-3 text-right tabular-nums text-zinc-400">
                  {app.tokensUsed || '0'}
                </td>

                {/* Status */}
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                    app.status === 'paused'
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-400'
                      : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                  }`}>
                    {app.status === 'paused' ? 'Paused' : 'Active'}
                  </span>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  {confirmDeleteId === app.id ? (
                    <div className="flex items-center justify-end space-x-1.5 animate-in fade-in duration-150">
                      <span className="text-xs text-red-400 font-medium mr-1">Confirm delete?</span>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(app.id)}
                        disabled={isDeleting}
                        className="px-2 py-1 rounded-md bg-red-950/80 border border-red-800 text-red-200 text-xs font-medium hover:bg-red-900 transition-colors duration-150 ease-out cursor-pointer"
                      >
                        {isDeleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isDeleting}
                        className="px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 text-xs hover:text-white transition-colors duration-150 ease-out cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-1.5">
                      {/* Copy link */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(app)}
                        title="Copy link"
                        className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
                      >
                        {copiedId === app.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Open app in new tab */}
                      <a
                        href={`/app/${app.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in new tab"
                        className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Pause / Resume */}
                      <button
                        type="button"
                        onClick={() => handleToggle(app)}
                        disabled={isTogglingId === app.id}
                        title={app.status === 'paused' ? 'Resume app' : 'Pause app'}
                        className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
                      >
                        {app.status === 'paused' ? (
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Pause className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(app.id)}
                        title="Delete app"
                        className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
