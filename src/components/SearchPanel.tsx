import React, { useState } from 'react';
import { CaseSensitive, Regex, Search } from 'lucide-react';
import type { SearchMatch } from '../shared/types';

interface SearchPanelProps {
  workspaceId: string;
  onJumpToMatch: (path: string, line: number, column: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  workspaceId,
  onJumpToMatch,
}) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) {
      setMatches([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        case: String(caseSensitive),
        regex: String(useRegex),
      });
      const res = await fetch(`/api/workspaces/${workspaceId}/search?${params}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="font-semibold text-slate-700 dark:text-slate-200">
          Search in Files
        </div>
        <form onSubmit={runSearch} className="space-y-1.5">
          <div className="flex items-center gap-1 bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 focus-within:border-teal-500">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspace..."
              aria-label="Search query across workspace files"
              className="flex-1 bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setCaseSensitive((v) => !v)}
              aria-label="Toggle match case"
              aria-pressed={caseSensitive}
              title="Match Case"
              className={`p-1 rounded ${
                caseSensitive
                  ? 'bg-teal-500/20 text-teal-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setUseRegex((v) => !v)}
              aria-label="Toggle regular expression"
              aria-pressed={useRegex}
              title="Use Regular Expression"
              className={`p-1 rounded ${
                useRegex
                  ? 'bg-teal-500/20 text-teal-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Regex className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors"
          >
            {loading ? 'Searching...' : 'Find in Files'}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {searched && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1 pb-1">
            {matches.length} {matches.length === 1 ? 'result' : 'results'}
          </div>
        )}

        {searched && matches.length === 0 && (
          <div className="text-center text-slate-400 py-6">
            No matching occurrences found.
          </div>
        )}

        {matches.map((m, idx) => (
          <button
            key={`${m.path}-${m.line}-${idx}`}
            type="button"
            onClick={() => onJumpToMatch(m.path, m.line, m.column)}
            className="w-full text-left p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-teal-600 dark:text-teal-400">
              <span className="truncate">{m.path}</span>
              <span className="font-mono text-slate-400 shrink-0">:{m.line}</span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
              {m.text}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
