import React from 'react';
import { Zap, Cpu, Users, BarChart2 } from 'lucide-react';

interface MetricsGridProps {
  totalRuns: number;
  tokensUsed: string;
  activeUsers: number;
  activeAppsCount: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  totalRuns,
  tokensUsed,
  activeUsers,
  activeAppsCount,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      
      {/* 1. Total Runs */}
      <div className="promptos-panel p-4 rounded-xl text-left">
        <div className="flex items-center justify-between text-zinc-500 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Total Runs</span>
          <Zap className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
          {totalRuns.toLocaleString()}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-1">
          Authenticated runs
        </div>
      </div>

      {/* 2. Tokens Consumed */}
      <div className="promptos-panel p-4 rounded-xl text-left">
        <div className="flex items-center justify-between text-zinc-500 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Tokens Processed</span>
          <Cpu className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
          {tokensUsed}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-1">
          Aggregated usage
        </div>
      </div>

      {/* 3. Active Consumers */}
      <div className="promptos-panel p-4 rounded-xl text-left">
        <div className="flex items-center justify-between text-zinc-500 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Active Users</span>
          <Users className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
          {activeUsers.toLocaleString()}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-1">
          Active access passes
        </div>
      </div>

      {/* 4. Active Deployed Apps */}
      <div className="promptos-panel p-4 rounded-xl text-left">
        <div className="flex items-center justify-between text-zinc-500 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Deployed Apps</span>
          <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight">
          {activeAppsCount}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-1">
          Live mini-apps
        </div>
      </div>

    </div>
  );
};
