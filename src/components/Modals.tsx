import React, { useState } from 'react';
import {
  Command,
  Download,
  FolderPlus,
  Search,
  Settings,
  Upload,
  X,
} from 'lucide-react';
import { PROJECT_TEMPLATES } from '../shared/templates';
import { PYID_TO_PYTHON_KEYWORDS } from '../shared/pyidTranspiler';
import type { IdeSettings } from '../shared/types';

export interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

export const CommandPaletteModal: React.FC<{
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
}> = ({ open, commands, onClose }) => {
  const [query, setQuery] = useState('');
  if (!open) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Command Palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
          <Command className="w-4 h-4 text-teal-500" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => {
                onClose();
                cmd.run();
              }}
              className="w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between hover:bg-teal-500/15 text-slate-700 dark:text-slate-200"
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && (
                <span className="font-mono text-[11px] text-slate-400">
                  {cmd.shortcut}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">
              No matching commands.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<{
  open: boolean;
  settings: IdeSettings;
  onUpdate: (next: IdeSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onClose: () => void;
}> = ({ open, settings, onUpdate, onExportBackup, onImportBackup, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="CONDO IDE Settings"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-xs"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-100">
            <Settings className="w-4 h-4 text-teal-500" />
            <span>IDE Settings & Sync</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="font-medium text-slate-600 dark:text-slate-300 block">
                Theme Mode
              </span>
              <select
                value={settings.themeMode}
                onChange={(e) =>
                  onUpdate({
                    ...settings,
                    themeMode: e.target.value as 'dark' | 'light',
                    activeThemeId:
                      e.target.value === 'light'
                        ? 'condo-daylight'
                        : 'condo-navy-teal',
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-100 dark:bg-[#080d1a] border border-slate-300 dark:border-slate-700"
              >
                <option value="dark">Dark Mode (Navy & Teal)</option>
                <option value="light">Light Mode (Daylight)</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-600 dark:text-slate-300 block">
                Editor Font Size ({settings.fontSize}px)
              </span>
              <input
                type="range"
                min={11}
                max={22}
                value={settings.fontSize}
                onChange={(e) =>
                  onUpdate({ ...settings, fontSize: Number(e.target.value) })
                }
                className="w-full accent-teal-500"
              />
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-600 dark:text-slate-300 block">
                Tab Size
              </span>
              <select
                value={settings.tabSize}
                onChange={(e) =>
                  onUpdate({ ...settings, tabSize: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-100 dark:bg-[#080d1a] border border-slate-300 dark:border-slate-700"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-600 dark:text-slate-300 block">
                Default Language Mode
              </span>
              <select
                value={settings.defaultLanguageMode}
                onChange={(e) =>
                  onUpdate({
                    ...settings,
                    defaultLanguageMode: e.target.value as 'pyid' | 'python',
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-100 dark:bg-[#080d1a] border border-slate-300 dark:border-slate-700"
              >
                <option value="pyid">Python Indonesia (PyID / .cdo)</option>
                <option value="python">Standard Python (.py)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) =>
                  onUpdate({ ...settings, autoSave: e.target.checked })
                }
                className="accent-teal-500"
              />
              <span>Auto Save</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.minimap}
                onChange={(e) =>
                  onUpdate({ ...settings, minimap: e.target.checked })
                }
                className="accent-teal-500"
              />
              <span>Show Minimap</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(e) =>
                  onUpdate({ ...settings, wordWrap: e.target.checked })
                }
                className="accent-teal-500"
              />
              <span>Word Wrap</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.lineNumbers}
                onChange={(e) =>
                  onUpdate({ ...settings, lineNumbers: e.target.checked })
                }
                className="accent-teal-500"
              />
              <span>Line Numbers</span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-medium text-slate-700 dark:text-slate-200">
              Settings Sync, Backup & Restore (.cdopack)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-teal-600 hover:text-white flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Settings & Extensions Backup</span>
              </button>
              <label className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-teal-600 hover:text-white flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Backup</span>
                <input
                  type="file"
                  accept=".json,.cdopack"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportBackup(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TemplatesModal: React.FC<{
  open: boolean;
  onCreateWorkspace: (templateId: string, name: string) => void;
  onClose: () => void;
}> = ({ open, onCreateWorkspace, onClose }) => {
  const [selectedId, setSelectedId] = useState(PROJECT_TEMPLATES[0].id);
  const [name, setName] = useState('Proyek-Baru');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="New Project from Template"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-xs"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <FolderPlus className="w-4 h-4 text-teal-500" />
            <span>Create New CONDO Project</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close templates dialog"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreateWorkspace(selectedId, name.trim());
            onClose();
          }}
          className="p-4 space-y-4"
        >
          <label className="block space-y-1">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Project Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-slate-100 dark:bg-[#080d1a] border border-slate-300 dark:border-slate-700 outline-none focus:border-teal-500"
            />
          </label>

          <div className="space-y-2">
            <div className="font-medium text-slate-600 dark:text-slate-300">
              Select Template
            </div>
            {PROJECT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedId(tpl.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedId === tpl.id
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
                  <span>{tpl.name}</span>
                  <span className="font-mono text-[10px] text-teal-500 uppercase">
                    {tpl.mode}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {tpl.description}
                </p>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PyIdReferenceModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  if (!open) return null;
  const entries = Object.entries(PYID_TO_PYTHON_KEYWORDS);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="PyID Language & Shortcuts Reference"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-xs"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="font-semibold text-sm">
            CONDO IDE — Python Indonesia (PyID) & Shortcuts Reference
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reference modal"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
            {entries.map(([pyid, py]) => (
              <div
                key={pyid}
                className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <span className="text-teal-600 dark:text-teal-400 font-semibold">
                  {pyid}
                </span>
                <span className="text-slate-400">→ {py}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const GoToLineModal: React.FC<{
  open: boolean;
  onGo: (line: number) => void;
  onClose: () => void;
}> = ({ open, onGo, onClose }) => {
  const [val, setVal] = useState('1');
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const num = parseInt(val, 10);
          if (!Number.isNaN(num) && num > 0) {
            onGo(num);
            onClose();
          }
        }}
        className="w-full max-w-xs rounded-xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-700 shadow-xl p-3 flex items-center gap-2"
      >
        <Search className="w-4 h-4 text-teal-500" />
        <input
          type="number"
          min={1}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Go to line..."
          aria-label="Line number"
          className="flex-1 bg-transparent text-xs outline-none font-mono"
        />
        <button
          type="submit"
          className="px-2.5 py-1 rounded bg-teal-600 text-white text-xs font-medium"
        >
          Go
        </button>
      </form>
    </div>
  );
};
