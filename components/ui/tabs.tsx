import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div
      className={cn(
        'grid p-1 bg-zinc-900 rounded-md border border-zinc-800 text-sm font-medium',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-md transition-colors duration-150 ease-out cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]',
              isActive
                ? 'bg-zinc-800 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
