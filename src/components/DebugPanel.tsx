import React, { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  Bug,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import type { DebugState } from '../shared/types';

interface DebugPanelProps {
  debugState: DebugState;
  breakpoints: Record<string, number[]>;
  watches: string[];
  activeFilePath: string | null;
  onStartDebug: (stopOnEntry: boolean) => void;
  onDebugCommand: (action: 'continue' | 'step_over' | 'step_into' | 'step_out' | 'stop') => void;
  onToggleBreakpoint: (file: string, line: number) => void;
  onAddWatch: (expr: string) => void;
  onRemoveWatch: (expr: string) => void;
  onJumpToLocation: (file: string, line: number) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  debugState,
  breakpoints,
  watches,
  activeFilePath,
  onStartDebug,
  onDebugCommand,
  onToggleBreakpoint,
  onAddWatch,
  onRemoveWatch,
  onJumpToLocation,
}) => {
  const [watchInput, setWatchInput] = useState('');
  const [stopOnEntry, setStopOnEntry] = useState(true);

  const isPaused = debugState.status === 'paused';
  const isActive = debugState.status === 'running' || debugState.status === 'paused';

  const allBreakpoints = Object.entries(breakpoints).flatMap(([file, lines]) =>
    lines.map((line) => ({ file, line }))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Header & Controls */}
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Run and Debug (bdb)
          </span>
          <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400">
            {debugState.status}
          </span>
        </div>

        {!isActive ? (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onStartDebug(stopOnEntry)}
              className="w-full py-1.5 px-3 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium flex items-center justify-center gap-1.5"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Debug {activeFilePath || 'Active File'}</span>
            </button>
            <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={stopOnEntry}
                onChange={(e) => setStopOnEntry(e.target.checked)}
                className="accent-teal-500"
              />
              <span>Stop on first executable line</span>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              disabled={!isPaused}
              onClick={() => onDebugCommand('continue')}
              title="Continue (F5)"
              aria-label="Continue debugging"
              className="p-1.5 rounded bg-teal-600 text-white disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!isPaused}
              onClick={() => onDebugCommand('step_over')}
              title="Step Over (F10)"
              aria-label="Step Over"
              className="p-1.5 rounded bg-slate-200 dark:bg-slate-800 disabled:opacity-40"
            >
              <ArrowRightFromLine className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!isPaused}
              onClick={() => onDebugCommand('step_into')}
              title="Step Into (F11)"
              aria-label="Step Into"
              className="p-1.5 rounded bg-slate-200 dark:bg-slate-800 disabled:opacity-40"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!isPaused}
              onClick={() => onDebugCommand('step_out')}
              title="Step Out (Shift+F11)"
              aria-label="Step Out"
              className="p-1.5 rounded bg-slate-200 dark:bg-slate-800 disabled:opacity-40"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onStartDebug(stopOnEntry)}
              title="Restart Debugger"
              aria-label="Restart Debugger"
              className="p-1.5 rounded bg-slate-200 dark:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDebugCommand('stop')}
              title="Stop Debugger"
              aria-label="Stop Debugger"
              className="p-1.5 rounded bg-rose-600 text-white"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Variables */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Variables (Locals)
          </div>
          {debugState.locals.length === 0 ? (
            <div className="text-slate-400">
              {isPaused ? 'No local variables in scope.' : 'Pause at a breakpoint to inspect.'}
            </div>
          ) : (
            <div className="space-y-0.5 font-mono text-[11px]">
              {debugState.locals.map((v) => (
                <div key={v.name} className="flex items-start justify-between gap-2 py-0.5">
                  <span className="text-cyan-600 dark:text-cyan-400 shrink-0">{v.name}</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate" title={v.value}>
                    {v.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Watch Expressions */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Watch Expressions
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (watchInput.trim()) {
                onAddWatch(watchInput.trim());
                setWatchInput('');
              }
            }}
            className="flex gap-1 mb-1.5"
          >
            <input
              type="text"
              value={watchInput}
              onChange={(e) => setWatchInput(e.target.value)}
              placeholder="e.g. len(hasil)"
              aria-label="Add watch expression"
              className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs font-mono"
            />
            <button
              type="submit"
              aria-label="Add watch"
              className="p-1.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-teal-600 hover:text-white"
            >
              <Plus className="w-3 h-3" />
            </button>
          </form>

          {watches.map((expr) => {
            const res = debugState.watchResults.find((w) => w.expression === expr);
            return (
              <div
                key={expr}
                className="flex items-center justify-between gap-1 py-0.5 font-mono text-[11px]"
              >
                <span className="truncate text-slate-700 dark:text-slate-300">
                  {expr}:{' '}
                  <span className={res?.error ? 'text-rose-400' : 'text-teal-500'}>
                    {res ? (res.error ? res.error : res.value) : '—'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveWatch(expr)}
                  aria-label={`Remove watch ${expr}`}
                  className="text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Call Stack */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Call Stack
          </div>
          {debugState.frames.length === 0 ? (
            <div className="text-slate-400">Not paused.</div>
          ) : (
            <div className="space-y-0.5">
              {debugState.frames.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => onJumpToLocation(frame.file, frame.line)}
                  className="w-full text-left px-1.5 py-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2"
                >
                  <span className="font-mono text-slate-700 dark:text-slate-200 truncate">
                    {frame.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {frame.file}:{frame.line}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Breakpoints */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Breakpoints ({allBreakpoints.length})
          </div>
          {allBreakpoints.length === 0 ? (
            <div className="text-slate-400">
              Click the editor gutter margin to toggle breakpoints.
            </div>
          ) : (
            <div className="space-y-0.5">
              {allBreakpoints.map((bp) => (
                <div
                  key={`${bp.file}:${bp.line}`}
                  className="flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800/70"
                >
                  <button
                    type="button"
                    onClick={() => onJumpToLocation(bp.file, bp.line)}
                    className="flex-1 text-left font-mono text-[11px] truncate"
                  >
                    {bp.file}:{bp.line}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleBreakpoint(bp.file, bp.line)}
                    aria-label={`Remove breakpoint at ${bp.file}:${bp.line}`}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
