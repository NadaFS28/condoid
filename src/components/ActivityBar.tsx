import React from 'react';
import {
  Blocks,
  Bug,
  Files,
  GitBranch,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ActivityView } from '../shared/types';

interface ActivityBarProps {
  activeView: ActivityView;
  sidebarOpen: boolean;
  onSelectView: (view: ActivityView) => void;
  gitChangesCount: number;
  problemsCount: number;
}

const ITEMS: Array<{
  id: ActivityView;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'explorer', label: 'Explorer', icon: Files },
  { id: 'search', label: 'Search in Files', icon: Search },
  { id: 'git', label: 'Source Control (Git)', icon: GitBranch },
  { id: 'debug', label: 'Run and Debug', icon: Bug },
  { id: 'extensions', label: 'Extensions & Themes', icon: Blocks },
  { id: 'ai', label: 'CONDO AI Assistant', icon: Sparkles },
];

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  sidebarOpen,
  onSelectView,
  gitChangesCount,
}) => {
  return (
    <aside
      aria-label="Activity Bar"
      className="hidden md:flex flex-col items-center w-12 shrink-0 py-2 gap-1 bg-slate-100 dark:bg-[#070b16] border-r border-slate-200 dark:border-slate-800/90 select-none"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = sidebarOpen && activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectView(item.id)}
            aria-label={item.label}
            title={item.label}
            className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800/70'
            }`}
          >
            <Icon className="w-5 h-5" />
            {item.id === 'git' && gitChangesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-teal-600 text-white text-[10px] font-mono font-semibold flex items-center justify-center">
                {gitChangesCount}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
};
