import React, { useState } from 'react';
import {
  Check,
  DownloadCloud,
  FileDiff,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Minus,
  Plus,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import type { GitStatusResponse } from '../shared/types';

interface GitPanelProps {
  workspaceId: string;
  gitStatus: GitStatusResponse | null;
  onRefresh: () => void;
  onOpenFile: (path: string) => void;
  onNotify: (msg: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
  workspaceId,
  gitStatus,
  onRefresh,
  onOpenFile,
  onNotify,
}) => {
  const [commitMsg, setCommitMsg] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [mergeBranch, setMergeBranch] = useState('');
  const [diffText, setDiffText] = useState<string | null>(null);
  const [diffTitle, setDiffTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const postGit = async (endpoint: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/git/${workspaceId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify(`Git error: ${data.error || 'Command failed'}`);
        return null;
      }
      onRefresh();
      return data;
    } finally {
      setBusy(false);
    }
  };

  const handleInit = async () => {
    const res = await postGit('init');
    if (res) onNotify('Initialized Git repository on branch main.');
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;
    await postGit('stage');
    const res = await postGit('commit', { message: commitMsg.trim() });
    if (res) {
      setCommitMsg('');
      onNotify('Committed changes cleanly.');
    }
  };

  const handleViewDiff = async (filePath?: string) => {
    const url = `/api/git/${workspaceId}/diff${filePath ? `?path=${encodeURIComponent(filePath)}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setDiffTitle(filePath || 'All unstaged changes');
    setDiffText(data.diff || '(No textual diff available or untracked file)');
  };

  if (!gitStatus || !gitStatus.initialized) {
    return (
      <div className="p-3 text-xs space-y-3">
        <div className="font-semibold text-slate-700 dark:text-slate-200">
          Source Control (Git)
        </div>
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
          This workspace is not yet a Git repository. Initialize Git to track changes,
          branches, diffs, and commits.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={handleInit}
          className="w-full py-2 px-3 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors"
        >
          Initialize Git Repository
        </button>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="font-medium text-slate-600 dark:text-slate-300">
            Or Clone Repository
          </div>
          <input
            type="url"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            aria-label="Repository URL to clone"
            className="w-full px-2 py-1.5 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs outline-none focus:border-teal-500"
          />
          <button
            type="button"
            disabled={busy || !cloneUrl.trim()}
            onClick={async () => {
              const r = await postGit('clone', { url: cloneUrl.trim() });
              if (r) {
                setCloneUrl('');
                onNotify('Repository cloned into workspace.');
              }
            }}
            className="w-full py-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:border-teal-500 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-50"
          >
            Git Clone
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <GitBranch className="w-3.5 h-3.5 text-teal-500" />
            <span>{gitStatus.branch}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenFile('.gitignore')}
              className="px-1.5 py-0.5 rounded text-[11px] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
              title="Edit .gitignore"
            >
              .gitignore
            </button>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh Git status"
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleCommit} className="space-y-1.5">
          <input
            type="text"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message (e.g. feat: tambah modul pyid)"
            aria-label="Git commit message"
            className="w-full px-2 py-1.5 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={busy || !commitMsg.trim()}
            className="w-full py-1.5 rounded-md bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Stage All & Commit</span>
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Changed Files */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span>Changes ({gitStatus.files.length})</span>
            <button
              type="button"
              onClick={() => postGit('stage')}
              className="text-teal-600 dark:text-teal-400 hover:underline"
            >
              Stage All
            </button>
          </div>
          {gitStatus.files.length === 0 ? (
            <div className="text-slate-400 py-1">Working tree clean.</div>
          ) : (
            <div className="space-y-0.5">
              {gitStatus.files.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800/70 gap-1"
                >
                  <button
                    type="button"
                    onClick={() => onOpenFile(f.path)}
                    className="flex-1 text-left truncate text-slate-700 dark:text-slate-200"
                  >
                    {f.path}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-[10px] text-amber-500">
                      {f.indexStatus !== ' ' ? f.indexStatus : f.workingStatus}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleViewDiff(f.path)}
                      aria-label={`View diff for ${f.path}`}
                      title="View Diff"
                      className="p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-700"
                    >
                      <FileDiff className="w-3 h-3" />
                    </button>
                    {f.staged ? (
                      <button
                        type="button"
                        onClick={() => postGit('unstage', { path: f.path })}
                        aria-label={`Unstage ${f.path}`}
                        title="Unstage"
                        className="p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => postGit('stage', { path: f.path })}
                        aria-label={`Stage ${f.path}`}
                        title="Stage"
                        className="p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diff Viewer */}
        {diffText !== null && (
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060a14] p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium truncate">Diff: {diffTitle}</span>
              <button
                type="button"
                onClick={() => setDiffText(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <pre className="font-mono text-[11px] overflow-x-auto max-h-36 whitespace-pre text-slate-700 dark:text-slate-300">
              {diffText}
            </pre>
          </div>
        )}

        {/* Branch & Merge */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Branches & Merge
          </div>
          <div className="flex gap-1">
            <select
              aria-label="Switch Git branch"
              value={gitStatus.branch}
              onChange={(e) => postGit('branch', { name: e.target.value, create: false })}
              className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs"
            >
              {gitStatus.branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="New branch name"
              aria-label="New branch name"
              className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs"
            />
            <button
              type="button"
              disabled={!newBranch.trim()}
              onClick={async () => {
                const r = await postGit('branch', { name: newBranch.trim(), create: true });
                if (r) setNewBranch('');
              }}
              className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-teal-600 hover:text-white"
            >
              Create
            </button>
          </div>
          {gitStatus.branches.length > 1 && (
            <div className="flex gap-1">
              <select
                aria-label="Branch to merge"
                value={mergeBranch}
                onChange={(e) => setMergeBranch(e.target.value)}
                className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs"
              >
                <option value="">Merge branch...</option>
                {gitStatus.branches
                  .filter((b) => b !== gitStatus.branch)
                  .map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!mergeBranch}
                onClick={async () => {
                  const r = await postGit('merge', { branch: mergeBranch });
                  if (r) onNotify(r.output || 'Merged.');
                }}
                className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 flex items-center gap-1 disabled:opacity-50"
              >
                <GitMerge className="w-3 h-3" />
                <span>Merge</span>
              </button>
            </div>
          )}
        </div>

        {/* Remote Sync (GitHub Pull / Push) */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Remote (GitHub / Origin)
          </div>
          <input
            type="text"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder={gitStatus.remoteUrl || 'https://github.com/user/repo.git'}
            aria-label="Remote origin URL"
            className="w-full px-2 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const r = await postGit('sync', {
                  action: 'pull',
                  remoteUrl: remoteUrl.trim() || undefined,
                });
                if (r) onNotify(r.output || 'Pulled from origin.');
              }}
              className="py-1 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1 hover:border-teal-500"
            >
              <DownloadCloud className="w-3 h-3" />
              <span>Pull</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const r = await postGit('sync', {
                  action: 'push',
                  remoteUrl: remoteUrl.trim() || undefined,
                });
                if (r) onNotify(r.output || 'Pushed to origin.');
              }}
              className="py-1 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1 hover:border-teal-500"
            >
              <UploadCloud className="w-3 h-3" />
              <span>Push</span>
            </button>
          </div>
        </div>

        {/* Commit History */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            History ({gitStatus.commits.length})
          </div>
          {gitStatus.commits.length === 0 ? (
            <div className="text-slate-400">No commits yet.</div>
          ) : (
            gitStatus.commits.map((c) => (
              <div key={c.hash} className="py-1 border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-1.5">
                  <GitCommitHorizontal className="w-3 h-3 text-teal-500 shrink-0" />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {c.message}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 pl-4">
                  {c.hash} · {c.author} · {c.date}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
