import React from 'react';
import {
  Blocks,
  Code2,
  Files,
  Play,
  Redo2,
  Terminal,
  Undo2,
} from 'lucide-react';

export type MobilePane = 'editor' | 'explorer' | 'terminal' | 'tools';

interface MobileToolbarProps {
  activePane: MobilePane;
  onSelectPane: (pane: MobilePane) => void;
  onRun: () => void;
  onInsertSnippet: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const CODING_KEYS = [
  { label: 'Tab', value: '    ' },
  { label: ':', value: ':' },
  { label: '(', value: '()' },
  { label: ')', value: ')' },
  { label: '[', value: '[]' },
  { label: '"', value: '""' },
  { label: "'", value: "''" },
  { label: '=', value: ' = ' },
  { label: '_', value: '_' },
  { label: '#', value: '# ' },
  { label: 'jika', value: 'jika ' },
  { label: 'fungsi', value: 'fungsi ' },
  { label: 'tampilkan', value: 'tampilkan()' },
];

export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  activePane,
  onSelectPane,
  onRun,
  onInsertSnippet,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="md:hidden shrink-0 select-none z-30">
      {/* Touch Keyboard Coding Toolbar (visible when editing) */}
      {activePane === 'editor' && (
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-[#090f1d] border-t border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={onUndo}
            aria-label="Undo edit"
            className="min-h-[36px] min-w-[36px] px-2 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            aria-label="Redo edit"
            className="min-h-[36px] min-w-[36px] px-2 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          {CODING_KEYS.map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => onInsertSnippet(k.value)}
              className="min-h-[36px] px-2.5 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-teal-300 active:bg-teal-500/20 shrink-0"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {/* Thumb-Zone Bottom Navigation Bar (>= 44px targets) */}
      <nav
        aria-label="Mobile IDE Navigation"
        className="grid grid-cols-5 items-center h-13 bg-white/95 dark:bg-[#060a14]/95 border-t border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          onClick={() => onSelectPane('explorer')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activePane === 'explorer'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Files className="w-4 h-4" />
          <span>Files</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPane('editor')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activePane === 'editor'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Editor</span>
        </button>

        <button
          type="button"
          onClick={onRun}
          aria-label="Run code on mobile"
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Run</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPane('terminal')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activePane === 'terminal'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Terminal</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPane('tools')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activePane === 'tools'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Blocks className="w-4 h-4" />
          <span>Tools</span>
        </button>
      </nav>
    </div>
  );
};
