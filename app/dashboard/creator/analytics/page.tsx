'use client';

import React, { useState, useEffect } from 'react';

interface AppBreakdown {
  id: string;
  name: string;
  slug: string;
  runs: number;
  tokens: number;
  lastRun: string | null;
  dailyLimit: number;
  tokensToday: number;
}

export default function CreatorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalRuns: number;
    totalTokens: number;
    activeUsers: number;
    appBreakdown: AppBreakdown[];
  }>({
    totalRuns: 0,
    totalTokens: 0,
    activeUsers: 0,
    appBreakdown: [],
  });

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/creator/analytics');
        if (res.ok) {
          const json = await res.json();
          setData({
            totalRuns: json.totalRuns || 0,
            totalTokens: json.totalTokens || 0,
            activeUsers: json.activeUsers || 0,
            appBreakdown: json.appBreakdown || [],
          });
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-zinc-800">
        <h1 className="font-semibold text-xl tracking-tight text-white">Analytics</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Execution counts, token consumption, and per-app usage limits.
        </p>
      </div>

      {/* 1. Raw numbers with tabular-nums */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-md border border-zinc-800 bg-[#09090b]">
          <div className="text-xs text-zinc-400 font-medium">Total runs</div>
          <div className="text-2xl font-semibold text-white tracking-tight tabular-nums mt-1">
            {data.totalRuns.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">All-time executions</div>
        </div>

        <div className="p-4 rounded-md border border-zinc-800 bg-[#09090b]">
          <div className="text-xs text-zinc-400 font-medium">Total tokens</div>
          <div className="text-2xl font-semibold text-white tracking-tight tabular-nums mt-1">
            {data.totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Input and output tokens processed</div>
        </div>

        <div className="p-4 rounded-md border border-zinc-800 bg-[#09090b]">
          <div className="text-xs text-zinc-400 font-medium">Active users (30d)</div>
          <div className="text-2xl font-semibold text-white tracking-tight tabular-nums mt-1">
            {data.activeUsers.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Unique accounts in the last 30 days</div>
        </div>
      </div>

      {/* 2. Per-app breakdown table */}
      <div className="rounded-md border border-zinc-800 bg-[#09090b] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Per-app breakdown</h2>
          <span className="text-xs text-zinc-400 font-medium">
            {data.appBreakdown.length} {data.appBreakdown.length === 1 ? 'app' : 'apps'}
          </span>
        </div>

        {data.appBreakdown.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            No analytics data recorded yet. Numbers will appear once users run your deployed mini-apps.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400">
                  <th className="py-2.5 px-4">App</th>
                  <th className="py-2.5 px-3 text-right">Runs</th>
                  <th className="py-2.5 px-3 text-right">Tokens</th>
                  <th className="py-2.5 px-3 text-right">Last run</th>
                  <th className="py-2.5 px-4 text-right">Tokens vs daily limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                {data.appBreakdown.map((item) => {
                  const percentOfLimit = Math.min(
                    100,
                    Math.round((item.tokensToday / item.dailyLimit) * 100)
                  );

                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors duration-150 ease-out">
                      {/* App Name */}
                      <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                        {item.name}
                      </td>

                      {/* Runs */}
                      <td className="py-3 px-3 text-right tabular-nums text-white">
                        {item.runs.toLocaleString()}
                      </td>

                      {/* Tokens */}
                      <td className="py-3 px-3 text-right tabular-nums text-zinc-300">
                        {item.tokens.toLocaleString()}
                      </td>

                      {/* Last Run */}
                      <td className="py-3 px-3 text-right tabular-nums text-xs text-zinc-400">
                        {item.lastRun || 'Never'}
                      </td>

                      {/* Tokens used vs daily limit */}
                      <td className="py-3 px-4 text-right tabular-nums text-xs">
                        <span className="text-zinc-200">
                          {item.tokensToday.toLocaleString()}
                        </span>
                        <span className="text-zinc-500 mx-1">/</span>
                        <span className="text-zinc-400">
                          {item.dailyLimit.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-zinc-500 ml-1.5 font-mono">
                          ({percentOfLimit}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
