import React, { useEffect, useRef, useState } from 'react';
import {
  Bug,
  ChevronDown,
  Menu,
  Moon,
  Play,
  Save,
  Settings,
  Square,
  Sun,
  Terminal as TerminalIcon,
} from 'lucide-react';

export interface TopMenuAction {
  label: string;
  shortcut?: string;
  onClick: () => void;
  dividerAfter?: boolean;
}

interface TopBarProps {
  projectName: string;
  themeMode: 'dark' | 'light';
  isRunning: boolean;
  hasUnsaved: boolean;
  onRun: () => void;
  onStop: () => void;
  onDebug: () => void;
  onSave: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onToggleMobileDrawer?: () => void;
  menus: Record<string, TopMenuAction[]>;
}

const MENU_ORDER = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  themeMode,
  isRunning,
  hasUnsaved,
  onRun,
  onStop,
  onDebug,
  onSave,
  onToggleTheme,
  onOpenSettings,
  onToggleMobileDrawer,
  menus,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <header className="h-11 shrink-0 flex items-center justify-between px-2.5 md:px-3 bg-slate-100 dark:bg-[#060a14] border-b border-slate-200 dark:border-slate-800/90 text-slate-800 dark:text-slate-200 select-none z-30">
      {/* Left: Brand + Menus */}
      <div className="flex items-center gap-2 min-w-0" ref={menuContainerRef}>
        {onToggleMobileDrawer && (
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            aria-label="Toggle workspace menu"
            className="md:hidden min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 pr-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
            <TerminalIcon className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
          </div>
          <span className="font-bold tracking-tight text-sm text-slate-900 dark:text-white whitespace-nowrap">
            CONDO
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5" aria-label="IDE Menu Bar">
          {MENU_ORDER.map((menuName) => {
            const items = menus[menuName] || [];
            const isOpen = openMenu === menuName;
            return (
              <div key={menuName} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(isOpen ? null : menuName)}
                  onMouseEnter={() => {
                    if (openMenu) setOpenMenu(menuName);
                  }}
                  aria-expanded={isOpen}
                  className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                    isOpen
                      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  {menuName}
                </button>
                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-1 w-60 rounded-lg bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-700/80 shadow-xl py-1 z-50"
                  >
                    {items.map((item, idx) => (
                      <React.Fragment key={`${menuName}-${idx}`}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenu(null);
                            item.onClick();
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-300"
                        >
                          <span className="truncate">{item.label}</span>
                          {item.shortcut && (
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 ml-3 shrink-0">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                        {item.dividerAfter && (
                          <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-800 min-w-0">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
            {projectName}
          </span>
        </div>
      </div>

      {/* Right: Primary IDE Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isRunning ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop running program"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRun}
            aria-label="Run active file"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDebug}
          aria-label="Run and debug active file"
          title="Debug Active File (F5)"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-200/80 dark:bg-slate-800/90 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Bug className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="hidden md:inline">Debug</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          aria-label="Save active file"
          title="Save (Ctrl/Cmd+S)"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            hasUnsaved
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-slate-200/80 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Save</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
        >
          {themeMode === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open IDE settings"
          title="Settings"
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Compact menu trigger on tablet */}
        <div className="lg:hidden relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'Help' ? null : 'Help')}
            aria-label="Quick help and commands"
            className="hidden sm:flex items-center gap-0.5 px-2 py-1 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <span>Help</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
