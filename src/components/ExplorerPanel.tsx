import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Pencil,
  Scissors,
  Trash2,
  Upload,
} from 'lucide-react';
import type { FileNode, WorkspaceSummary } from '../shared/types';
import { getFileBadgeText } from '../utils/fileHelpers';

interface ExplorerPanelProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  tree: FileNode[];
  activeFilePath: string | null;
  recentFiles: string[];
  localFolderName: string | null;
  onSelectWorkspace: (id: string) => void;
  onOpenTemplatesModal: () => void;
  onOpenFile: (path: string) => void;
  onCreateFile: (parentPath: string, name: string) => void;
  onCreateFolder: (parentPath: string, name: string) => void;
  onRenamePath: (oldPath: string, newPath: string) => void;
  onDeletePath: (path: string) => void;
  onDuplicatePath: (path: string) => void;
  onMovePath: (srcPath: string, dstFolder: string) => void;
  onOpenLocalFolder: () => void;
  onImportZip: (file: File) => void;
  onExportZip: () => void;
  onImportPyFiles: (files: FileList) => void;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  workspaces,
  activeWorkspaceId,
  tree,
  activeFilePath,
  recentFiles,
  localFolderName,
  onSelectWorkspace,
  onOpenTemplatesModal,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenamePath,
  onDeletePath,
  onDuplicatePath,
  onMovePath,
  onOpenLocalFolder,
  onImportZip,
  onExportZip,
  onImportPyFiles,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState<{
    type: 'file' | 'folder';
    parent: string;
  } | null>(null);
  const [createName, setCreateName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [clipboard, setClipboard] = useState<{ path: string; mode: 'copy' | 'cut' } | null>(
    null
  );
  const [dragSrc, setDragSrc] = useState<string | null>(null);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const pyInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = createName.trim();
    if (!clean || !creating) return;
    if (creating.type === 'file') {
      onCreateFile(creating.parent, clean);
    } else {
      onCreateFolder(creating.parent, clean);
    }
    if (creating.parent) {
      setExpanded((prev) => ({ ...prev, [creating.parent]: true }));
    }
    setCreating(null);
    setCreateName('');
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const parts = renamingPath.split('/');
    parts.pop();
    const newPath = [...parts, renameValue.trim()].join('/');
    if (newPath !== renamingPath) {
      onRenamePath(renamingPath, newPath);
    }
    setRenamingPath(null);
  };

  const handlePaste = (targetFolder: string) => {
    if (!clipboard) return;
    const baseName = clipboard.path.split('/').pop() || 'item';
    const dst = targetFolder ? `${targetFolder}/${baseName}` : baseName;
    if (clipboard.mode === 'cut') {
      onMovePath(clipboard.path, targetFolder);
      setClipboard(null);
    } else {
      onDuplicatePath(clipboard.path);
    }
    void dst;
  };

  const renderNode = (node: FileNode, depth: number) => {
    const isFolder = node.type === 'folder';
    const isExpanded = Boolean(expanded[node.path]);
    const isActive = activeFilePath === node.path;
    const isRenaming = renamingPath === node.path;
    const badge = getFileBadgeText(node.name);

    return (
      <div key={node.path}>
        <div
          draggable
          onDragStart={() => setDragSrc(node.path)}
          onDragOver={(e) => {
            if (isFolder) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (isFolder && dragSrc && dragSrc !== node.path) {
              onMovePath(dragSrc, node.path);
              setExpanded((prev) => ({ ...prev, [node.path]: true }));
            }
            setDragSrc(null);
          }}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          className={`group flex items-center justify-between pr-1.5 py-1 text-xs rounded-md transition-colors ${
            isActive
              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 font-medium'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/70'
          }`}
        >
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className="flex-1 flex items-center gap-1 pr-1">
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                aria-label={`Rename ${node.name}`}
                className="w-full px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 border border-teal-500 rounded outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => (isFolder ? toggleFolder(node.path) : onOpenFile(node.path))}
              className="flex-1 flex items-center gap-1.5 text-left min-w-0 py-0.5"
            >
              {isFolder ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                  )}
                </>
              ) : (
                <span
                  className={`font-mono text-[9px] font-bold w-6 shrink-0 text-left ${badge.colorClass}`}
                >
                  {badge.label}
                </span>
              )}
              <span className="truncate">{node.name}</span>
            </button>
          )}

          {/* Row Quick Actions */}
          {!isRenaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
              {isFolder && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded((prev) => ({ ...prev, [node.path]: true }));
                      setCreating({ type: 'file', parent: node.path });
                      setCreateName('module.cdo');
                    }}
                    aria-label={`New file inside ${node.name}`}
                    title="New File Here"
                    className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  {clipboard && (
                    <button
                      type="button"
                      onClick={() => handlePaste(node.path)}
                      aria-label={`Paste into ${node.name}`}
                      title="Paste Here"
                      className="p-1 rounded text-teal-400 hover:bg-slate-300/60 dark:hover:bg-slate-700"
                    >
                      <FileCode2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setRenamingPath(node.path);
                  setRenameValue(node.name);
                }}
                aria-label={`Rename ${node.name}`}
                title="Rename"
                className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDuplicatePath(node.path)}
                aria-label={`Duplicate ${node.name}`}
                title="Duplicate"
                className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setClipboard({ path: node.path, mode: 'cut' })}
                aria-label={`Cut ${node.name}`}
                title="Cut / Move"
                className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
              >
                <Scissors className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDeletePath(node.path)}
                aria-label={`Delete ${node.name}`}
                title="Delete"
                className="p-1 rounded hover:bg-rose-500/20 text-rose-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {isFolder && isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Workspace Selector */}
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
            Workspace
          </span>
          <button
            type="button"
            onClick={onOpenTemplatesModal}
            className="text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline whitespace-nowrap"
          >
            + New Project
          </button>
        </div>

        <select
          aria-label="Select active workspace"
          value={activeWorkspaceId}
          onChange={(e) => onSelectWorkspace(e.target.value)}
          className="w-full px-2 py-1.5 rounded-md bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-teal-500"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>

        {localFolderName && (
          <div className="flex items-center gap-1.5 text-[11px] text-teal-600 dark:text-teal-400 truncate">
            <HardDrive className="w-3 h-3 shrink-0" />
            <span className="truncate">Local sync: {localFolderName}</span>
          </div>
        )}
      </div>

      {/* File Toolbar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800/80">
        <span className="font-medium text-slate-500 dark:text-slate-400">Files</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setCreating({ type: 'file', parent: '' });
              setCreateName('baru.cdo');
            }}
            aria-label="New File"
            title="New File (.cdo / .py)"
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating({ type: 'folder', parent: '' });
              setCreateName('modul');
            }}
            aria-label="New Folder"
            title="New Folder"
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenLocalFolder}
            aria-label="Open Local Folder"
            title="Open Local Folder (File System Access API)"
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <HardDrive className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => pyInputRef.current?.click()}
            aria-label="Import Python or CDO File"
            title="Import .py / .cdo File"
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExportZip}
            aria-label="Export Workspace as ZIP"
            title="Export Project ZIP"
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,.cdopack"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportZip(f);
            e.target.value = '';
          }}
        />
        <input
          ref={pyInputRef}
          type="file"
          multiple
          accept=".py,.cdo,.txt,.json,.md,.cdoproj,.cdotheme,.cdosnippet"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportPyFiles(e.target.files);
            }
            e.target.value = '';
          }}
        />
      </div>

      {/* Inline New File/Folder Form */}
      {creating && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-2 border-b border-slate-200 dark:border-slate-800 bg-teal-500/5 space-y-1.5"
        >
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            New {creating.type} {creating.parent ? `in ${creating.parent}` : 'in root'}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              aria-label={`New ${creating.type} name`}
              placeholder={creating.type === 'file' ? 'script.cdo' : 'folder_name'}
              className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-teal-500 outline-none"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded bg-teal-600 text-white text-xs font-medium"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Root drop zone + file tree */}
      <div
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dragSrc) {
            onMovePath(dragSrc, '');
            setDragSrc(null);
          }
        }}
      >
        {clipboard && (
          <div className="flex items-center justify-between px-2 py-1 mb-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-300">
            <span className="truncate">Moving: {clipboard.path}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handlePaste('')}
                className="underline font-medium"
              >
                Paste Root
              </button>
              <button
                type="button"
                onClick={() => setClipboard(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {tree.length === 0 ? (
          <div className="p-4 text-center text-slate-400">
            No files in workspace yet.
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Footer Actions: Import ZIP + Recent Files */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-2 space-y-2 bg-slate-50 dark:bg-[#090f1d]">
        <button
          type="button"
          onClick={() => zipInputRef.current?.click()}
          className="w-full py-1.5 px-2 rounded-md border border-slate-300 dark:border-slate-700 hover:border-teal-500 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import ZIP / .cdopack</span>
        </button>

        {recentFiles.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Recent Files
            </div>
            <div className="max-h-20 overflow-y-auto space-y-0.5">
              {recentFiles.slice(0, 4).map((rf) => (
                <button
                  key={rf}
                  type="button"
                  onClick={() => onOpenFile(rf)}
                  className="w-full text-left px-1.5 py-0.5 rounded text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 truncate"
                >
                  {rf}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
