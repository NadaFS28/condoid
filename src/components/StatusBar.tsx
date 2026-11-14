import React from 'react';
import { AlertCircle, AlertTriangle, GitBranch, Terminal } from 'lucide-react';
import type {
  DiagnosticItem,
  FileEncoding,
  LanguageMode,
  LineEnding,
} from '../shared/types';

interface StatusBarProps {
  cursor: { line: number; column: number };
  language: LanguageMode | null;
  encoding: FileEncoding;
  lineEnding: LineEnding;
  gitBranch: string;
  gitDirtyCount: number;
  interpreterLabel: string;
  diagnostics: DiagnosticItem[];
  onToggleLanguage: () => void;
  onToggleLineEnding: () => void;
  onToggleEncoding: () => void;
  onOpenProblems: () => void;
  onOpenGit: () => void;
  onOpenPackages: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cursor,
  language,
  encoding,
  lineEnding,
  gitBranch,
  gitDirtyCount,
  interpreterLabel,
  diagnostics,
  onToggleLanguage,
  onToggleLineEnding,
  onToggleEncoding,
  onOpenProblems,
  onOpenGit,
  onOpenPackages,
}) => {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <footer className="hidden md:flex h-6 shrink-0 items-center justify-between px-3 bg-slate-200/90 dark:bg-[#050912] border-t border-slate-300 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 select-none">
      {/* Left: Git, Problems */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenGit}
          className="flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          <GitBranch className="w-3 h-3 text-teal-600 dark:text-teal-400" />
          <span>{gitBranch || 'No Git'}</span>
          {gitDirtyCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">*{gitDirtyCount}</span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenProblems}
          className="flex items-center gap-2 hover:text-teal-600 dark:hover:text-teal-400 transition-colors font-mono"
        >
          <span className="flex items-center gap-0.5">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            {errors}
          </span>
          <span className="flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            {warnings}
          </span>
        </button>
      </div>

      {/* Right: Cursor, Encoding, Line Ending, Language, Interpreter */}
      <div className="flex items-center gap-4 font-mono">
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>

        <button
          type="button"
          onClick={onToggleEncoding}
          className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          title="Click to cycle file encoding"
        >
          {encoding}
        </button>

        <button
          type="button"
          onClick={onToggleLineEnding}
          className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          title="Click to toggle LF / CRLF"
        >
          {lineEnding}
        </button>

        {language && (
          <button
            type="button"
            onClick={onToggleLanguage}
            className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors uppercase"
            title="Switch PyID / Python mode"
          >
            {language === 'pyid' ? 'PyID (.cdo)' : language}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenPackages}
          className="flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 transition-colors"
          title="Manage Python Interpreter & Packages"
        >
          <Terminal className="w-3 h-3" />
          <span>{interpreterLabel}</span>
        </button>
      </div>
    </footer>
  );
};
