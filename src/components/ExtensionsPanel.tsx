import React, { useState } from 'react';
import {
  Blocks,
  CheckCircle2,
  Palette,
  Play,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { CondoExtension, CondoSnippet, CondoTheme } from '../shared/types';

interface ExtensionsPanelProps {
  extensions: CondoExtension[];
  themes: CondoTheme[];
  activeThemeId: string;
  snippets: CondoSnippet[];
  onToggleInstall: (id: string) => void;
  onToggleEnable: (id: string) => void;
  onSelectTheme: (themeId: string) => void;
  onRunExtensionCommand: (extId: string, commandId: string) => void;
  onInsertSnippet: (body: string) => void;
}

export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({
  extensions,
  themes,
  activeThemeId,
  snippets,
  onToggleInstall,
  onToggleEnable,
  onSelectTheme,
  onRunExtensionCommand,
  onInsertSnippet,
}) => {
  const [tab, setTab] = useState<'extensions' | 'themes' | 'snippets'>('extensions');
  const [query, setQuery] = useState('');
  const [selectedExtId, setSelectedExtId] = useState<string | null>(null);

  const filteredExts = extensions.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.description.toLowerCase().includes(query.toLowerCase())
  );

  const selectedExt = extensions.find((e) => e.id === selectedExtId);

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="font-semibold text-slate-700 dark:text-slate-200">
          Extensions & Themes
        </div>

        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-slate-200/80 dark:bg-[#060a14]">
          <button
            type="button"
            onClick={() => setTab('extensions')}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              tab === 'extensions'
                ? 'bg-white dark:bg-[#0d1526] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Plugins
          </button>
          <button
            type="button"
            onClick={() => setTab('themes')}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              tab === 'themes'
                ? 'bg-white dark:bg-[#0d1526] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Themes
          </button>
          <button
            type="button"
            onClick={() => setTab('snippets')}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              tab === 'snippets'
                ? 'bg-white dark:bg-[#0d1526] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Snippets
          </button>
        </div>

        {tab === 'extensions' && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Browse marketplace..."
              aria-label="Search extensions marketplace"
              className="flex-1 bg-transparent outline-none text-xs"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tab === 'extensions' && !selectedExt && (
          <div className="space-y-2">
            {filteredExts.map((ext) => (
              <div
                key={ext.id}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#0d1526]/70 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExtId(ext.id)}
                    className="text-left font-semibold text-slate-800 dark:text-slate-100 hover:text-teal-500"
                  >
                    {ext.name}
                  </button>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    v{ext.version}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {ext.description}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">
                    {ext.author} · {ext.category}
                  </span>
                  <div className="flex items-center gap-1">
                    {ext.installed && (
                      <button
                        type="button"
                        onClick={() => onToggleEnable(ext.id)}
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px]"
                      >
                        {ext.enabled ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleInstall(ext.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        ext.installed
                          ? 'bg-rose-500/15 text-rose-500 hover:bg-rose-500/25'
                          : 'bg-teal-600 text-white hover:bg-teal-500'
                      }`}
                    >
                      {ext.installed ? 'Uninstall' : 'Install'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'extensions' && selectedExt && (
          <div className="space-y-3 p-1">
            <button
              type="button"
              onClick={() => setSelectedExtId(null)}
              className="text-teal-600 dark:text-teal-400 hover:underline"
            >
              ← Back to Marketplace
            </button>
            <div className="flex items-center gap-2">
              <Blocks className="w-5 h-5 text-teal-500" />
              <div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {selectedExt.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedExt.id} · v{selectedExt.version}
                </div>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedExt.description}
            </p>
            <div className="p-2 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-teal-600 dark:text-teal-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sandbox Permissions</span>
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {selectedExt.permissions.join(' · ')}
              </div>
            </div>

            {selectedExt.installed &&
              selectedExt.enabled &&
              selectedExt.commands &&
              selectedExt.commands.length > 0 && (
                <div className="space-y-1">
                  <div className="font-medium text-slate-500 dark:text-slate-400">
                    Extension Commands
                  </div>
                  {selectedExt.commands.map((cmd) => (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => onRunExtensionCommand(selectedExt.id, cmd.id)}
                      className="w-full py-1.5 px-2 rounded bg-teal-600 text-white flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3 h-3" />
                      <span>{cmd.title}</span>
                    </button>
                  ))}
                </div>
              )}
          </div>
        )}

        {tab === 'themes' && (
          <div className="space-y-2">
            {themes.map((t) => {
              const active = t.id === activeThemeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                    active
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-teal-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {t.name}
                      </span>
                    </div>
                    {active && <CheckCircle2 className="w-4 h-4 text-teal-500" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[t.colors.bg, t.colors.editorBg, t.colors.accent, t.colors.keyword, t.colors.string].map(
                      (hex, idx) => (
                        <span
                          key={idx}
                          className="w-4 h-4 rounded border border-slate-400/30"
                          style={{ backgroundColor: hex }}
                        />
                      )
                    )}
                    <span className="ml-auto text-[10px] text-slate-400 uppercase">
                      {t.type}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'snippets' && (
          <div className="space-y-2">
            {snippets.map((s) => (
              <div
                key={s.id}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">
                    {s.prefix}
                  </span>
                  <span className="text-[10px] text-slate-400">{s.language}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {s.description}
                </div>
                <button
                  type="button"
                  onClick={() => onInsertSnippet(s.body.replace(/\$\{\d+:?([^}]*)\}/g, '$1'))}
                  className="mt-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-teal-600 hover:text-white text-[11px] font-medium"
                >
                  Insert into Editor
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
