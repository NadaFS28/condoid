import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityBar } from './components/ActivityBar';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { BottomPanel } from './components/BottomPanel';
import { DebugPanel } from './components/DebugPanel';
import { EditorArea } from './components/EditorArea';
import { ExplorerPanel } from './components/ExplorerPanel';
import { ExtensionsPanel } from './components/ExtensionsPanel';
import { GitPanel } from './components/GitPanel';
import {
  CommandPaletteModal,
  GoToLineModal,
  PyIdReferenceModal,
  SettingsModal,
  TemplatesModal,
  type PaletteCommand,
} from './components/Modals';
import { MobileToolbar, type MobilePane } from './components/MobileToolbar';
import { SearchPanel } from './components/SearchPanel';
import { StatusBar } from './components/StatusBar';
import { TopBar, type TopMenuAction } from './components/TopBar';
import { BUILTIN_SNIPPETS, BUILTIN_THEMES } from './shared/templates';
import { transpilePyIdToPython } from './shared/pyidTranspiler';
import { formatCode, lintPythonOrPyId } from './shared/pythonFormatter';
import type {
  ActivityView,
  BottomTab,
  CondoExtension,
  CondoSnippet,
  CondoTheme,
  DebugState,
  DiagnosticItem,
  EditorTab,
  FileNode,
  GitStatusResponse,
  IdeSettings,
  LanguageMode,
  OutputLine,
  WorkspaceSummary,
} from './shared/types';
import { executeSandboxedExtensionCommand } from './utils/extensionSandbox';
import { detectLanguageFromFilename } from './utils/fileHelpers';
import {
  downloadBlobFile,
  openLocalFolder,
  saveFileAsLocal,
  writeToLocalDirHandle,
} from './utils/fsAccess';
import {
  DEFAULT_SETTINGS,
  loadCustomSnippets,
  loadCustomThemes,
  loadExtensions,
  loadRecentFiles,
  loadRecoverySession,
  pushRecentFile,
  saveExtensions,
  saveRecoverySession,
  saveSettings,
  loadSettings,
} from './utils/idbStorage';
import { updateMonacoSnippets } from './utils/monacoPyid';
import { exportZipArchive, importZipArchive } from './utils/zipUtils';

export default function App() {
  // Core Workspace & File State
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [splitTabPath, setSplitTabPath] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [localDirHandle, setLocalDirHandle] = useState<any>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);

  // Workbench Layout & UI State
  const [settings, setSettings] = useState<IdeSettings>(DEFAULT_SETTINGS);
  const [activeView, setActiveView] = useState<ActivityView>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [bottomHeight, setBottomHeight] = useState(220);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [recoveryPrompt, setRecoveryPrompt] = useState<{
    workspaceId: string;
    openTabs: Array<{ path: string; content: string; isDirty: boolean }>;
  } | null>(null);

  // Modals
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);

  // Extensions, Themes, Snippets
  const [extensions, setExtensions] = useState<CondoExtension[]>([]);
  const [themes, setThemes] = useState<CondoTheme[]>(BUILTIN_THEMES);
  const [snippets, setSnippets] = useState<CondoSnippet[]>(BUILTIN_SNIPPETS);

  // Diagnostics, Git, Runtime & Debugger
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [interpreterLabel, setInterpreterLabel] = useState('Python 3.10');
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({});
  const [watches, setWatches] = useState<string[]>([]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugState, setDebugState] = useState<DebugState>({
    status: 'idle',
    frames: [],
    locals: [],
    globals: [],
    watchResults: [],
  });

  const runtimeWsRef = useRef<WebSocket | null>(null);
  const editorApiRef = useRef<{
    goToLine: (line: number, column?: number) => void;
    insertText: (text: string) => void;
    triggerAction: (actionId: string) => void;
    undo: () => void;
    redo: () => void;
  } | null>(null);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3500);
  }, []);

  // Derived active tab & theme
  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activeTabPath) || null,
    [tabs, activeTabPath]
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) || null,
    [workspaces, activeWorkspaceId]
  );

  const allThemes = useMemo(() => {
    const extThemes = extensions
      .filter((e) => e.installed && e.enabled && e.theme)
      .map((e) => e.theme!);
    const map = new Map<string, CondoTheme>();
    for (const t of [...themes, ...extThemes]) {
      map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [themes, extensions]);

  const activeTheme = useMemo(
    () =>
      allThemes.find((t) => t.id === settings.activeThemeId) ||
      (settings.themeMode === 'light' ? BUILTIN_THEMES[2] : BUILTIN_THEMES[0]),
    [allThemes, settings.activeThemeId, settings.themeMode]
  );

  const allSnippets = useMemo(() => {
    const extSnippets = extensions
      .filter((e) => e.installed && e.enabled && e.snippets)
      .flatMap((e) => e.snippets!);
    return [...snippets, ...extSnippets];
  }, [snippets, extensions]);

  useEffect(() => {
    updateMonacoSnippets(allSnippets);
  }, [allSnippets]);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.themeMode]);

  const updateSettings = useCallback((next: IdeSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // Load workspace tree + git + python env
  const refreshWorkspaceData = useCallback(async (wsId: string) => {
    if (!wsId) return;
    const [treeRes, gitRes, pyRes] = await Promise.all([
      fetch(`/api/workspaces/${wsId}/tree`).then((r) => r.json()),
      fetch(`/api/git/${wsId}/status`).then((r) => r.json()),
      fetch(`/api/python/${wsId}/env`).then((r) => r.json()).catch(() => null),
    ]);
    if (treeRes.tree) setTree(treeRes.tree);
    if (gitRes && typeof gitRes.initialized === 'boolean') setGitStatus(gitRes);
    if (pyRes?.versionLabel) {
      setInterpreterLabel(pyRes.hasVenv ? `${pyRes.versionLabel} (.venv)` : pyRes.versionLabel);
    }
    return treeRes;
  }, []);

  const openFile = useCallback(
    async (filePath: string, jumpLine?: number, jumpCol?: number) => {
      if (!activeWorkspaceId) return;
      const existing = tabs.find((t) => t.path === filePath);
      if (existing) {
        setActiveTabPath(filePath);
        setMobilePane('editor');
        if (jumpLine) {
          setTimeout(() => editorApiRef.current?.goToLine(jumpLine, jumpCol || 1), 40);
        }
        return;
      }

      const res = await fetch(
        `/api/workspaces/${activeWorkspaceId}/file?path=${encodeURIComponent(filePath)}`
      );
      if (!res.ok) {
        notify(`Could not open ${filePath}`);
        return;
      }
      const data = await res.json();
      const name = filePath.split('/').pop() || filePath;
      const lang = detectLanguageFromFilename(name, settings.defaultLanguageMode);
      const newTab: EditorTab = {
        path: filePath,
        name,
        content: data.content,
        savedContent: data.content,
        language: lang,
        encoding: settings.defaultEncoding,
        lineEnding: data.content.includes('\r\n') ? 'CRLF' : settings.defaultLineEnding,
        isDirty: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabPath(filePath);
      setMobilePane('editor');
      pushRecentFile(filePath).then(setRecentFiles);

      if (jumpLine) {
        setTimeout(() => editorApiRef.current?.goToLine(jumpLine, jumpCol || 1), 60);
      }
    },
    [
      activeWorkspaceId,
      tabs,
      settings.defaultLanguageMode,
      settings.defaultEncoding,
      settings.defaultLineEnding,
      notify,
    ]
  );

  // Initial Boot
  useEffect(() => {
    const boot = async () => {
      const [loadedSettings, loadedExts, loadedThemes, loadedSnips, recents, recovery] =
        await Promise.all([
          loadSettings(),
          loadExtensions(),
          loadCustomThemes(),
          loadCustomSnippets(),
          loadRecentFiles(),
          loadRecoverySession(),
        ]);

      setSettings(loadedSettings);
      setExtensions(loadedExts);
      setThemes(loadedThemes);
      setSnippets(loadedSnips);
      setRecentFiles(recents);

      const wsRes = await fetch('/api/workspaces').then((r) => r.json());
      const wsList: WorkspaceSummary[] = wsRes.workspaces || [];
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        const wsId = wsList[0].id;
        setActiveWorkspaceId(wsId);
        const treeData = await refreshWorkspaceData(wsId);
        const entryFile =
          treeData?.config?.entryPoint ||
          treeData?.tree?.find((n: FileNode) => n.type === 'file')?.path;

        if (recovery && recovery.workspaceId === wsId && recovery.openTabs.some((t) => t.isDirty)) {
          setRecoveryPrompt({
            workspaceId: recovery.workspaceId,
            openTabs: recovery.openTabs,
          });
        }

        if (entryFile) {
          const fRes = await fetch(
            `/api/workspaces/${wsId}/file?path=${encodeURIComponent(entryFile)}`
          );
          if (fRes.ok) {
            const fData = await fRes.json();
            const name = entryFile.split('/').pop() || entryFile;
            setTabs([
              {
                path: entryFile,
                name,
                content: fData.content,
                savedContent: fData.content,
                language: detectLanguageFromFilename(
                  name,
                  loadedSettings.defaultLanguageMode
                ),
                encoding: loadedSettings.defaultEncoding,
                lineEnding: loadedSettings.defaultLineEnding,
                isDirty: false,
              },
            ]);
            setActiveTabPath(entryFile);
          }
        }
      }
    };
    boot();
  }, [refreshWorkspaceData]);

  // Save helpers
  const saveTab = useCallback(
    async (tabToSave: EditorTab) => {
      if (!activeWorkspaceId) return;
      const contentToWrite =
        tabToSave.lineEnding === 'CRLF'
          ? tabToSave.content.replace(/\r?\n/g, '\r\n')
          : tabToSave.content.replace(/\r\n/g, '\n');

      await fetch(`/api/workspaces/${activeWorkspaceId}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tabToSave.path, content: contentToWrite }),
      });

      if (localDirHandle) {
        await writeToLocalDirHandle(localDirHandle, tabToSave.path, contentToWrite);
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.path === tabToSave.path
            ? { ...t, savedContent: t.content, isDirty: false }
            : t
        )
      );
      fetch(`/api/git/${activeWorkspaceId}/status`)
        .then((r) => r.json())
        .then((g) => setGitStatus(g))
        .catch(() => {});
    },
    [activeWorkspaceId, localDirHandle]
  );

  const handleSaveActive = useCallback(async () => {
    if (!activeTab) return;
    await saveTab(activeTab);
    notify(`Saved ${activeTab.name}`);
  }, [activeTab, saveTab, notify]);

  const handleSaveAll = useCallback(async () => {
    const dirty = tabs.filter((t) => t.isDirty);
    for (const t of dirty) {
      await saveTab(t);
    }
    notify(dirty.length > 0 ? `Saved ${dirty.length} file(s)` : 'All files up to date');
  }, [tabs, saveTab, notify]);

  // Auto Save & Session Recovery Persistence
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const timer = setTimeout(() => {
      saveRecoverySession({
        workspaceId: activeWorkspaceId,
        openTabs: tabs.map((t) => ({
          path: t.path,
          content: t.content,
          isDirty: t.isDirty,
        })),
        activeTabPath,
        savedAt: Date.now(),
      });

      if (settings.autoSave) {
        tabs
          .filter((t) => t.isDirty)
          .forEach((t) => {
            saveTab(t);
          });
      }
    }, settings.autoSaveDelayMs);

    return () => clearTimeout(timer);
  }, [
    tabs,
    activeTabPath,
    activeWorkspaceId,
    settings.autoSave,
    settings.autoSaveDelayMs,
    saveTab,
  ]);

  // Live Linting (Static + CPython AST)
  useEffect(() => {
    if (!activeTab || !activeWorkspaceId) return;
    const timer = setTimeout(async () => {
      const staticDiags = lintPythonOrPyId(
        activeTab.content,
        activeTab.path,
        activeTab.language
      );

      let astDiags: DiagnosticItem[] = [];
      if (activeTab.language === 'pyid' || activeTab.language === 'python') {
        try {
          const res = await fetch(`/api/python/${activeWorkspaceId}/lint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: activeTab.path,
              content: activeTab.content,
              mode: activeTab.language,
            }),
          });
          const data = await res.json();
          astDiags = data.diagnostics || [];
        } catch {
          // ignore
        }
      }

      const merged = [...astDiags, ...staticDiags];
      setDiagnostics((prev) => [
        ...prev.filter((d) => d.file !== activeTab.path),
        ...merged,
      ]);
    }, 450);

    return () => clearTimeout(timer);
  }, [activeTab?.path, activeTab?.content, activeTab?.language, activeWorkspaceId]);

  // Runtime & Debugger WebSocket Connection
  const appendOutput = useCallback(
    (stream: OutputLine['stream'], text: string) => {
      setOutputLines((prev) => [
        ...prev.slice(-400),
        {
          id: `${Date.now()}-${Math.random()}`,
          stream,
          text,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const ensureRuntimeWs = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const existing = runtimeWsRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        resolve(existing);
        return;
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/runtime`);
      runtimeWsRef.current = ws;

      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error('Runtime WebSocket failed'));

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'started') {
            setIsRunning(true);
            appendOutput('system', `▶ Running ${msg.file} (CPython)...`);
          } else if (msg.type === 'stdout') {
            appendOutput('stdout', msg.data);
          } else if (msg.type === 'stderr') {
            appendOutput('stderr', msg.data);
          } else if (msg.type === 'exited') {
            setIsRunning(false);
            setDebugState((prev) => ({
              ...prev,
              status: 'idle',
              file: undefined,
              line: undefined,
              frames: [],
              locals: [],
            }));
            appendOutput('system', `■ Process exited with code ${msg.code}`);
          } else if (msg.type === 'debug_event') {
            const ev = msg.event;
            if (ev.type === 'started') {
              setIsRunning(true);
              setDebugState({
                status: 'running',
                frames: [],
                locals: [],
                globals: [],
                watchResults: [],
              });
              setDebugLogs((l) => [...l, `Debugger attached to ${ev.file}`]);
            } else if (ev.type === 'paused') {
              setDebugState({
                status: 'paused',
                file: ev.file,
                line: ev.line,
                frames: ev.frames || [],
                locals: ev.locals || [],
                globals: ev.globals || [],
                watchResults: ev.watchResults || [],
              });
              setDebugLogs((l) => [
                ...l,
                `Paused at ${ev.file}:${ev.line}`,
              ]);
              if (ev.file && ev.line) {
                editorApiRef.current?.goToLine(ev.line, 1);
              }
            } else if (ev.type === 'watches_updated') {
              setDebugState((prev) => ({
                ...prev,
                watchResults: ev.watchResults || [],
              }));
            } else if (ev.type === 'eval_result') {
              setDebugLogs((l) => [
                ...l,
                `>>> ${ev.expression}`,
                ev.error ? `Error: ${ev.error}` : String(ev.value),
              ]);
            } else if (ev.type === 'terminated') {
              setIsRunning(false);
              setDebugState((prev) => ({
                ...prev,
                status: 'idle',
                file: undefined,
                line: undefined,
              }));
              setDebugLogs((l) => [...l, 'Debugger session ended.']);
            }
          }
        } catch {
          // ignore
        }
      };
    });
  }, [appendOutput]);

  const handleRunActive = useCallback(
    async (overrideCode?: string) => {
      if (!activeWorkspaceId || !activeTab) {
        notify('Open a .cdo or .py file to run.');
        return;
      }
      if (activeTab.isDirty && !overrideCode) {
        await saveTab(activeTab);
      }
      setBottomOpen(true);
      setBottomTab('output');
      setOutputLines([]);
      const ws = await ensureRuntimeWs();
      ws.send(
        JSON.stringify({
          type: 'run',
          workspaceId: activeWorkspaceId,
          filePath: activeTab.path,
          content: overrideCode ?? activeTab.content,
          mode:
            activeTab.language === 'pyid' || activeTab.language === 'python'
              ? activeTab.language
              : undefined,
        })
      );
    },
    [activeWorkspaceId, activeTab, saveTab, ensureRuntimeWs, notify]
  );

  const handleStartDebug = useCallback(
    async (stopOnEntry: boolean) => {
      if (!activeWorkspaceId || !activeTab) {
        notify('Open a .cdo or .py file to debug.');
        return;
      }
      if (activeTab.isDirty) await saveTab(activeTab);
      setSidebarOpen(true);
      setActiveView('debug');
      setBottomOpen(true);
      setBottomTab('output');
      setOutputLines([
        {
          id: `dbg-${Date.now()}`,
          stream: 'system',
          text: `Debugging ${activeTab.path} with CPython bdb...`,
          timestamp: Date.now(),
        },
      ]);
      setDebugLogs([]);

      const ws = await ensureRuntimeWs();
      ws.send(
        JSON.stringify({
          type: 'debug',
          workspaceId: activeWorkspaceId,
          filePath: activeTab.path,
          content: activeTab.content,
          mode:
            activeTab.language === 'pyid' || activeTab.language === 'python'
              ? activeTab.language
              : undefined,
          breakpoints: breakpoints[activeTab.path] || [],
          watches,
          stopOnEntry,
        })
      );
    },
    [activeWorkspaceId, activeTab, saveTab, ensureRuntimeWs, breakpoints, watches, notify]
  );

  const handleStopRuntime = useCallback(() => {
    runtimeWsRef.current?.send(JSON.stringify({ type: 'stop' }));
  }, []);

  const handleDebugCmd = useCallback(
    (action: 'continue' | 'step_over' | 'step_into' | 'step_out' | 'stop') => {
      runtimeWsRef.current?.send(
        JSON.stringify({ type: 'debug_cmd', cmd: { action } })
      );
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSaveActive();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAll();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setGoToLineOpen(true);
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (mod && e.key === '`') {
        e.preventDefault();
        setBottomOpen((v) => !v);
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (debugState.status === 'paused') handleDebugCmd('continue');
        else handleRunActive();
      } else if (e.key === 'F10' && debugState.status === 'paused') {
        e.preventDefault();
        handleDebugCmd('step_over');
      } else if (e.key === 'F11' && debugState.status === 'paused') {
        e.preventDefault();
        handleDebugCmd('step_into');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveActive, handleSaveAll, handleRunActive, handleDebugCmd, debugState.status]);

  // File & Workspace CRUD Handlers
  const handleSelectWorkspace = async (wsId: string) => {
    setActiveWorkspaceId(wsId);
    setTabs([]);
    setActiveTabPath(null);
    setSplitTabPath(null);
    const treeData = await refreshWorkspaceData(wsId);
    const entry =
      treeData?.config?.entryPoint ||
      treeData?.tree?.find((n: FileNode) => n.type === 'file')?.path;
    if (entry) {
      const res = await fetch(
        `/api/workspaces/${wsId}/file?path=${encodeURIComponent(entry)}`
      );
      if (res.ok) {
        const data = await res.json();
        const name = entry.split('/').pop() || entry;
        setTabs([
          {
            path: entry,
            name,
            content: data.content,
            savedContent: data.content,
            language: detectLanguageFromFilename(name, settings.defaultLanguageMode),
            encoding: settings.defaultEncoding,
            lineEnding: settings.defaultLineEnding,
            isDirty: false,
          },
        ]);
        setActiveTabPath(entry);
      }
    }
  };

  const handleCreateWorkspace = async (templateId: string, name: string) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, name }),
    });
    const data = await res.json();
    if (data.workspace) {
      setWorkspaces((prev) => [data.workspace, ...prev]);
      await handleSelectWorkspace(data.workspace.id);
      notify(`Created project ${data.workspace.name}`);
    }
  };

  const handleCreateFile = async (parentPath: string, name: string) => {
    if (!activeWorkspaceId) return;
    const relPath = parentPath ? `${parentPath}/${name}` : name;
    const starter = name.endsWith('.cdo')
      ? `# ${name} — PyID\ntampilkan("Halo dari ${name}")\n`
      : name.endsWith('.py')
      ? `# ${name}\nprint("Hello from ${name}")\n`
      : '';
    await fetch(`/api/workspaces/${activeWorkspaceId}/file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath, content: starter }),
    });
    await refreshWorkspaceData(activeWorkspaceId);
    await openFile(relPath);
  };

  const handleCreateFolder = async (parentPath: string, name: string) => {
    if (!activeWorkspaceId) return;
    const relPath = parentPath ? `${parentPath}/${name}` : name;
    await fetch(`/api/workspaces/${activeWorkspaceId}/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath }),
    });
    await refreshWorkspaceData(activeWorkspaceId);
  };

  const handleRenamePath = async (oldPath: string, newPath: string) => {
    if (!activeWorkspaceId) return;
    await fetch(`/api/workspaces/${activeWorkspaceId}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });
    setTabs((prev) =>
      prev.map((t) =>
        t.path === oldPath
          ? {
              ...t,
              path: newPath,
              name: newPath.split('/').pop() || newPath,
            }
          : t
      )
    );
    if (activeTabPath === oldPath) setActiveTabPath(newPath);
    await refreshWorkspaceData(activeWorkspaceId);
  };

  const handleDeletePath = async (targetPath: string) => {
    if (!activeWorkspaceId) return;
    await fetch(
      `/api/workspaces/${activeWorkspaceId}/path?path=${encodeURIComponent(targetPath)}`,
      { method: 'DELETE' }
    );
    setTabs((prev) => prev.filter((t) => !t.path.startsWith(targetPath)));
    if (activeTabPath?.startsWith(targetPath)) setActiveTabPath(null);
    await refreshWorkspaceData(activeWorkspaceId);
  };

  const handleDuplicatePath = async (srcPath: string) => {
    if (!activeWorkspaceId) return;
    const parts = srcPath.split('/');
    const base = parts.pop() || 'copy';
    const dot = base.lastIndexOf('.');
    const copyName =
      dot > 0 ? `${base.slice(0, dot)}_copy${base.slice(dot)}` : `${base}_copy`;
    const dstPath = [...parts, copyName].join('/');
    await fetch(`/api/workspaces/${activeWorkspaceId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ srcPath, dstPath }),
    });
    await refreshWorkspaceData(activeWorkspaceId);
  };

  const handleMovePath = async (srcPath: string, dstFolder: string) => {
    const baseName = srcPath.split('/').pop() || srcPath;
    const dstPath = dstFolder ? `${dstFolder}/${baseName}` : baseName;
    if (dstPath !== srcPath) {
      await handleRenamePath(srcPath, dstPath);
    }
  };

  const handleOpenLocalFolder = async () => {
    try {
      const res = await openLocalFolder();
      setLocalDirHandle(res.handle);
      setLocalFolderName(res.folderName);
      await fetch(`/api/workspaces/${activeWorkspaceId}/import-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: res.files }),
      });
      await refreshWorkspaceData(activeWorkspaceId);
      notify(`Loaded local folder "${res.folderName}" (${res.files.length} files)`);
    } catch (err: any) {
      if (err?.message === 'UNSUPPORTED_FS_ACCESS' || err?.name === 'SecurityError') {
        notify(
          'Browser blocked direct folder picker in this frame. Use Import ZIP or Import File instead.'
        );
      } else if (err?.name !== 'AbortError') {
        notify(`Could not open folder: ${err?.message || 'Error'}`);
      }
    }
  };

  const handleImportZip = async (file: File) => {
    if (!activeWorkspaceId) return;
    const files = await importZipArchive(file);
    await fetch(`/api/workspaces/${activeWorkspaceId}/import-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    await refreshWorkspaceData(activeWorkspaceId);
    notify(`Imported ${files.length} files from ${file.name}`);
  };

  const handleExportZip = async () => {
    if (!activeWorkspaceId) return;
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}/export-files`);
    const data = await res.json();
    const blob = await exportZipArchive(
      activeWorkspace?.name || 'condo-project',
      data.files || []
    );
    downloadBlobFile(`${activeWorkspace?.id || 'condo-project'}.zip`, blob);
    notify('Exported project ZIP archive.');
  };

  const handleImportPyFiles = async (fileList: FileList) => {
    if (!activeWorkspaceId) return;
    const files: Array<{ path: string; content: string }> = [];
    for (const f of Array.from(fileList)) {
      files.push({ path: f.name, content: await f.text() });
    }
    await fetch(`/api/workspaces/${activeWorkspaceId}/import-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    await refreshWorkspaceData(activeWorkspaceId);
    if (files[0]) openFile(files[0].path);
    notify(`Imported ${files.length} file(s)`);
  };

  const handleExportPython = async (tabPath: string) => {
    const t = tabs.find((x) => x.path === tabPath);
    if (!t) return;
    const pyCode =
      t.language === 'pyid' ? transpilePyIdToPython(t.content).code : t.content;
    const pyName = t.name.replace(/\.cdo$/i, '.py');
    await saveFileAsLocal(pyName, pyCode);
    notify(`Exported ${pyName}`);
  };

  const handleFormatActive = () => {
    if (!activeTab) return;
    const formatted = formatCode(activeTab.content, activeTab.language);
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTab.path
          ? { ...t, content: formatted, isDirty: formatted !== t.savedContent }
          : t
      )
    );
    notify('Formatted document');
  };

  // Resizable Drag Handlers
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.min(480, Math.max(190, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomHeight;
    const onMove = (ev: MouseEvent) => {
      setBottomHeight(Math.min(500, Math.max(130, startH + (startY - ev.clientY))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Top Bar Menus
  const menus: Record<string, TopMenuAction[]> = {
    File: [
      {
        label: 'New File (.cdo / .py)',
        onClick: () => {
          setSidebarOpen(true);
          setActiveView('explorer');
          handleCreateFile('', `script_${Date.now().toString(36).slice(-4)}.cdo`);
        },
      },
      {
        label: 'New Project from Template...',
        onClick: () => setTemplatesOpen(true),
        dividerAfter: true,
      },
      { label: 'Save', shortcut: 'Ctrl+S', onClick: handleSaveActive },
      {
        label: 'Save As (Local File)...',
        onClick: () => activeTab && saveFileAsLocal(activeTab.name, activeTab.content),
      },
      { label: 'Save All', shortcut: 'Ctrl+Shift+S', onClick: handleSaveAll, dividerAfter: true },
      { label: 'Open Local Folder...', onClick: handleOpenLocalFolder },
      { label: 'Export Project ZIP', onClick: handleExportZip },
      {
        label: 'Export Active as .py',
        onClick: () => activeTab && handleExportPython(activeTab.path),
      },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => editorApiRef.current?.undo() },
      { label: 'Redo', shortcut: 'Ctrl+Y', onClick: () => editorApiRef.current?.redo(), dividerAfter: true },
      {
        label: 'Find in File',
        shortcut: 'Ctrl+F',
        onClick: () => editorApiRef.current?.triggerAction('actions.find'),
      },
      {
        label: 'Find & Replace',
        shortcut: 'Ctrl+H',
        onClick: () => editorApiRef.current?.triggerAction('editor.action.startFindReplaceAction'),
      },
      {
        label: 'Format Document',
        shortcut: 'Shift+Alt+F',
        onClick: handleFormatActive,
      },
    ],
    Selection: [
      {
        label: 'Select All',
        shortcut: 'Ctrl+A',
        onClick: () => editorApiRef.current?.triggerAction('editor.action.selectAll'),
      },
      {
        label: 'Add Cursor Above',
        onClick: () => editorApiRef.current?.triggerAction('editor.action.insertCursorAbove'),
      },
      {
        label: 'Add Cursor Below',
        onClick: () => editorApiRef.current?.triggerAction('editor.action.insertCursorBelow'),
      },
    ],
    View: [
      {
        label: 'Command Palette...',
        shortcut: 'Ctrl+Shift+P',
        onClick: () => setPaletteOpen(true),
        dividerAfter: true,
      },
      {
        label: sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar',
        shortcut: 'Ctrl+B',
        onClick: () => setSidebarOpen((v) => !v),
      },
      {
        label: bottomOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel',
        shortcut: 'Ctrl+`',
        onClick: () => setBottomOpen((v) => !v),
      },
      {
        label: 'Toggle Split Editor',
        onClick: () => {
          if (splitTabPath) setSplitTabPath(null);
          else if (tabs.length > 1) {
            const other = tabs.find((t) => t.path !== activeTabPath);
            if (other) setSplitTabPath(other.path);
          }
        },
      },
      {
        label: settings.themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        onClick: () =>
          updateSettings({
            ...settings,
            themeMode: settings.themeMode === 'dark' ? 'light' : 'dark',
            activeThemeId:
              settings.themeMode === 'dark' ? 'condo-daylight' : 'condo-navy-teal',
          }),
      },
    ],
    Go: [
      {
        label: 'Go to Line...',
        shortcut: 'Ctrl+G',
        onClick: () => setGoToLineOpen(true),
      },
      {
        label: 'Go to Definition',
        shortcut: 'F12',
        onClick: () => editorApiRef.current?.triggerAction('editor.action.revealDefinition'),
      },
      {
        label: 'Search in Files',
        onClick: () => {
          setSidebarOpen(true);
          setActiveView('search');
        },
      },
    ],
    Run: [
      { label: 'Run Active File', shortcut: 'F5', onClick: () => handleRunActive() },
      { label: 'Start Debugging', onClick: () => handleStartDebug(true) },
      { label: 'Stop Execution', onClick: handleStopRuntime },
    ],
    Terminal: [
      {
        label: 'Open Integrated Terminal',
        shortcut: 'Ctrl+`',
        onClick: () => {
          setBottomOpen(true);
          setBottomTab('terminal');
        },
      },
      {
        label: 'Open Packages & Venv',
        onClick: () => {
          setBottomOpen(true);
          setBottomTab('packages');
        },
      },
    ],
    Help: [
      { label: 'PyID Language Reference', onClick: () => setRefOpen(true) },
      { label: 'Settings & Backup', onClick: () => setSettingsOpen(true) },
    ],
  };

  const paletteCommands: PaletteCommand[] = [
    { id: 'run', label: 'Run Active Python / PyID File', shortcut: 'F5', run: () => handleRunActive() },
    { id: 'debug', label: 'Start Debugger (bdb)', run: () => handleStartDebug(true) },
    { id: 'save', label: 'File: Save', shortcut: 'Ctrl+S', run: handleSaveActive },
    { id: 'format', label: 'Format Document', run: handleFormatActive },
    { id: 'templates', label: 'New Project from Template', run: () => setTemplatesOpen(true) },
    { id: 'settings', label: 'Open Settings', run: () => setSettingsOpen(true) },
    { id: 'pyid-ref', label: 'Open PyID Keyword Reference', run: () => setRefOpen(true) },
    {
      id: 'theme',
      label: 'Toggle Dark / Light Theme',
      run: () =>
        updateSettings({
          ...settings,
          themeMode: settings.themeMode === 'dark' ? 'light' : 'dark',
          activeThemeId:
            settings.themeMode === 'dark' ? 'condo-daylight' : 'condo-navy-teal',
        }),
    },
    {
      id: 'ai',
      label: 'Open CONDO AI Assistant',
      run: () => {
        setSidebarOpen(true);
        setActiveView('ai');
      },
    },
  ];

  const renderSidebarContent = () => {
    switch (activeView) {
      case 'explorer':
        return (
          <ExplorerPanel
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            tree={tree}
            activeFilePath={activeTabPath}
            recentFiles={recentFiles}
            localFolderName={localFolderName}
            onSelectWorkspace={handleSelectWorkspace}
            onOpenTemplatesModal={() => setTemplatesOpen(true)}
            onOpenFile={(p) => openFile(p)}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRenamePath={handleRenamePath}
            onDeletePath={handleDeletePath}
            onDuplicatePath={handleDuplicatePath}
            onMovePath={handleMovePath}
            onOpenLocalFolder={handleOpenLocalFolder}
            onImportZip={handleImportZip}
            onExportZip={handleExportZip}
            onImportPyFiles={handleImportPyFiles}
          />
        );
      case 'search':
        return (
          <SearchPanel
            workspaceId={activeWorkspaceId}
            onJumpToMatch={(p, line, col) => openFile(p, line, col)}
          />
        );
      case 'git':
        return (
          <GitPanel
            workspaceId={activeWorkspaceId}
            gitStatus={gitStatus}
            onRefresh={() => refreshWorkspaceData(activeWorkspaceId)}
            onOpenFile={(p) => openFile(p)}
            onNotify={notify}
          />
        );
      case 'debug':
        return (
          <DebugPanel
            debugState={debugState}
            breakpoints={breakpoints}
            watches={watches}
            activeFilePath={activeTabPath}
            onStartDebug={handleStartDebug}
            onDebugCommand={handleDebugCmd}
            onToggleBreakpoint={(file, line) => {
              setBreakpoints((prev) => {
                const cur = prev[file] || [];
                const next = cur.includes(line)
                  ? cur.filter((l) => l !== line)
                  : [...cur, line].sort((a, b) => a - b);
                return { ...prev, [file]: next };
              });
            }}
            onAddWatch={(expr) => {
              const next = Array.from(new Set([...watches, expr]));
              setWatches(next);
              if (debugState.status === 'paused') {
                runtimeWsRef.current?.send(
                  JSON.stringify({
                    type: 'debug_cmd',
                    cmd: { action: 'set_watches', expressions: next },
                  })
                );
              }
            }}
            onRemoveWatch={(expr) => {
              setWatches((prev) => prev.filter((w) => w !== expr));
            }}
            onJumpToLocation={(file, line) => openFile(file, line)}
          />
        );
      case 'extensions':
        return (
          <ExtensionsPanel
            extensions={extensions}
            themes={allThemes}
            activeThemeId={activeTheme.id}
            snippets={allSnippets}
            onToggleInstall={(id) => {
              const next = extensions.map((e) =>
                e.id === id ? { ...e, installed: !e.installed, enabled: !e.installed } : e
              );
              setExtensions(next);
              saveExtensions(next);
            }}
            onToggleEnable={(id) => {
              const next = extensions.map((e) =>
                e.id === id ? { ...e, enabled: !e.enabled } : e
              );
              setExtensions(next);
              saveExtensions(next);
            }}
            onSelectTheme={(themeId) => {
              const found = allThemes.find((t) => t.id === themeId);
              if (found) {
                updateSettings({
                  ...settings,
                  activeThemeId: found.id,
                  themeMode: found.type,
                });
              }
            }}
            onRunExtensionCommand={(extId, cmdId) => {
              const ext = extensions.find((e) => e.id === extId);
              if (!ext) return;
              const res = executeSandboxedExtensionCommand(ext, cmdId, {
                getActiveCode: () => activeTab?.content || '',
                insertCodeAtCursor: (text) => editorApiRef.current?.insertText(text),
                notify,
              });
              if (!res.ok && res.error) notify(res.error);
            }}
            onInsertSnippet={(body) => editorApiRef.current?.insertText(body)}
          />
        );
      case 'ai':
        return (
          <AiAssistantPanel
            activeFilePath={activeTab?.path || null}
            activeCode={activeTab?.content || ''}
            activeLanguage={activeTab?.language || 'python'}
            onInsertCode={(code) => editorApiRef.current?.insertText(code)}
            onReplaceCode={(code) => {
              if (!activeTab) return;
              setTabs((prev) =>
                prev.map((t) =>
                  t.path === activeTab.path
                    ? { ...t, content: code, isDirty: code !== t.savedContent }
                    : t
                )
              );
            }}
            onCollectProjectContext={async () => {
              const res = await fetch(`/api/workspaces/${activeWorkspaceId}/export-files`);
              const data = await res.json();
              return data.files || [];
            }}
          />
        );
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#080d1a] text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      {!isFullscreen && (
        <TopBar
          projectName={activeWorkspace?.name || 'CONDO Workspace'}
          themeMode={settings.themeMode}
          isRunning={isRunning}
          hasUnsaved={tabs.some((t) => t.isDirty)}
          onRun={() => handleRunActive()}
          onStop={handleStopRuntime}
          onDebug={() => handleStartDebug(true)}
          onSave={handleSaveActive}
          onToggleTheme={() =>
            updateSettings({
              ...settings,
              themeMode: settings.themeMode === 'dark' ? 'light' : 'dark',
              activeThemeId:
                settings.themeMode === 'dark' ? 'condo-daylight' : 'condo-navy-teal',
            })
          }
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleMobileDrawer={() =>
            setMobilePane((p) => (p === 'explorer' ? 'editor' : 'explorer'))
          }
          menus={menus}
        />
      )}

      {/* Crash / Autosave Recovery Banner */}
      {recoveryPrompt && (
        <div className="px-4 py-1.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-xs">
          <span>
            Unsaved edits from your previous session were found in IndexedDB recovery storage.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTabs((prev) =>
                  prev.map((t) => {
                    const rec = recoveryPrompt.openTabs.find((r) => r.path === t.path);
                    return rec ? { ...t, content: rec.content, isDirty: true } : t;
                  })
                );
                setRecoveryPrompt(null);
                notify('Recovered unsaved session edits.');
              }}
              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-semibold"
            >
              Restore Edits
            </button>
            <button
              type="button"
              onClick={() => setRecoveryPrompt(null)}
              className="px-2 py-1 rounded hover:bg-slate-800/30"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Workbench Area */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">
        {/* Desktop Activity Bar */}
        {!isFullscreen && (
          <ActivityBar
            activeView={activeView}
            sidebarOpen={sidebarOpen}
            onSelectView={(v) => {
              if (sidebarOpen && activeView === v) {
                setSidebarOpen(false);
              } else {
                setActiveView(v);
                setSidebarOpen(true);
              }
            }}
            gitChangesCount={gitStatus?.files.length || 0}
            problemsCount={diagnostics.length}
          />
        )}

        {/* Desktop Resizable Sidebar */}
        {!isFullscreen && sidebarOpen && (
          <>
            <aside
              style={{ width: `${sidebarWidth}px` }}
              className="hidden md:flex flex-col shrink-0 bg-slate-50 dark:bg-[#0b1222] border-r border-slate-200 dark:border-slate-800/90 min-h-0"
            >
              {renderSidebarContent()}
            </aside>
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={startSidebarResize}
              className="hidden md:block w-1 cursor-col-resize hover:bg-teal-500/50 transition-colors shrink-0"
            />
          </>
        )}

        {/* Mobile Full-View Switcher for Explorer / Tools */}
        {mobilePane === 'explorer' && (
          <div className="md:hidden flex-1 bg-slate-50 dark:bg-[#0b1222] min-h-0 overflow-hidden">
            <ExplorerPanel
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              tree={tree}
              activeFilePath={activeTabPath}
              recentFiles={recentFiles}
              localFolderName={localFolderName}
              onSelectWorkspace={handleSelectWorkspace}
              onOpenTemplatesModal={() => setTemplatesOpen(true)}
              onOpenFile={(p) => openFile(p)}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRenamePath={handleRenamePath}
              onDeletePath={handleDeletePath}
              onDuplicatePath={handleDuplicatePath}
              onMovePath={handleMovePath}
              onOpenLocalFolder={handleOpenLocalFolder}
              onImportZip={handleImportZip}
              onExportZip={handleExportZip}
              onImportPyFiles={handleImportPyFiles}
            />
          </div>
        )}

        {mobilePane === 'tools' && (
          <div className="md:hidden flex-1 flex flex-col bg-slate-50 dark:bg-[#0b1222] min-h-0">
            <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
              {(
                [
                  { id: 'search', label: 'Search' },
                  { id: 'git', label: 'Git' },
                  { id: 'debug', label: 'Debug' },
                  { id: 'extensions', label: 'Plugins' },
                  { id: 'ai', label: 'AI' },
                ] as Array<{ id: ActivityView; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium shrink-0 ${
                    activeView === item.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Center Editor + Bottom Panel Column */}
        <main
          className={`flex-1 flex flex-col min-w-0 min-h-0 ${
            mobilePane === 'explorer' || mobilePane === 'tools' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div
            className={`flex-1 flex flex-col min-h-0 min-w-0 ${
              mobilePane === 'terminal' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <EditorArea
              workspaceName={activeWorkspace?.name || 'CONDO'}
              tabs={tabs}
              activeTabPath={activeTabPath}
              splitTabPath={splitTabPath}
              settings={settings}
              activeTheme={activeTheme}
              diagnostics={diagnostics}
              breakpoints={breakpoints}
              pausedLocation={
                debugState.status === 'paused'
                  ? { file: debugState.file, line: debugState.line }
                  : null
              }
              isFullscreen={isFullscreen}
              onSelectTab={(p) => setActiveTabPath(p)}
              onCloseTab={(p) => {
                setTabs((prev) => {
                  const next = prev.filter((t) => t.path !== p);
                  if (activeTabPath === p) {
                    setActiveTabPath(next[next.length - 1]?.path || null);
                  }
                  if (splitTabPath === p) setSplitTabPath(null);
                  return next;
                });
              }}
              onChangeContent={(p, content) => {
                setTabs((prev) =>
                  prev.map((t) =>
                    t.path === p
                      ? { ...t, content, isDirty: content !== t.savedContent }
                      : t
                  )
                );
              }}
              onChangeLanguage={(p, lang) => {
                setTabs((prev) =>
                  prev.map((t) => (t.path === p ? { ...t, language: lang } : t))
                );
              }}
              onTogglePreview={(p) => {
                setTabs((prev) =>
                  prev.map((t) =>
                    t.path === p ? { ...t, previewMode: !t.previewMode } : t
                  )
                );
              }}
              onToggleSplit={() => {
                if (splitTabPath) {
                  setSplitTabPath(null);
                } else {
                  const other = tabs.find((t) => t.path !== activeTabPath);
                  if (other) setSplitTabPath(other.path);
                }
              }}
              onSelectSplitTab={(p) => setSplitTabPath(p)}
              onToggleBreakpoint={(file, line) => {
                setBreakpoints((prev) => {
                  const cur = prev[file] || [];
                  const next = cur.includes(line)
                    ? cur.filter((l) => l !== line)
                    : [...cur, line].sort((a, b) => a - b);
                  return { ...prev, [file]: next };
                });
              }}
              onCursorChange={(line, column) => setCursor({ line, column })}
              onFormatDocument={handleFormatActive}
              onRunSelection={(selectedCode) => handleRunActive(selectedCode)}
              onExportPython={handleExportPython}
              onToggleFullscreen={() => setIsFullscreen((v) => !v)}
              onEditorReady={(api) => {
                editorApiRef.current = api;
              }}
            />
          </div>

          {/* Bottom Panel (Desktop resizable or Mobile Terminal view) */}
          {!isFullscreen && (bottomOpen || mobilePane === 'terminal') && (
            <div
              className={
                mobilePane === 'terminal'
                  ? 'flex-1 flex flex-col min-h-0'
                  : 'hidden md:flex md:flex-col shrink-0'
              }
            >
              <div
                role="separator"
                aria-orientation="horizontal"
                onMouseDown={startBottomResize}
                className="hidden md:block h-1 cursor-row-resize hover:bg-teal-500/50 transition-colors shrink-0"
              />
              <div className={mobilePane === 'terminal' ? 'flex-1 flex flex-col min-h-0' : 'shrink-0'}>
                <BottomPanel
                  workspaceId={activeWorkspaceId}
                  activeTab={bottomTab}
                  themeMode={settings.themeMode}
                  outputLines={outputLines}
                  diagnostics={diagnostics}
                  debugLogs={debugLogs}
                  isRunning={isRunning}
                  isDebugPaused={debugState.status === 'paused'}
                  height={mobilePane === 'terminal' ? 420 : bottomHeight}
                  onSelectTab={setBottomTab}
                  onClosePanel={() => {
                    setBottomOpen(false);
                    if (mobilePane === 'terminal') setMobilePane('editor');
                  }}
                  onSendRuntimeStdin={(text) => {
                    appendOutput('input', `> ${text}`);
                    runtimeWsRef.current?.send(
                      JSON.stringify({ type: 'stdin', data: text })
                    );
                  }}
                  onClearOutput={() => setOutputLines([])}
                  onJumpToLocation={(file, line, col) => openFile(file, line, col)}
                  onEvalDebugExpr={(expr) => {
                    runtimeWsRef.current?.send(
                      JSON.stringify({
                        type: 'debug_cmd',
                        cmd: { action: 'eval', expression: expr },
                      })
                    );
                  }}
                  onNotify={notify}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Desktop Status Bar */}
      {!isFullscreen && (
        <StatusBar
          cursor={cursor}
          language={activeTab?.language || null}
          encoding={activeTab?.encoding || settings.defaultEncoding}
          lineEnding={activeTab?.lineEnding || settings.defaultLineEnding}
          gitBranch={gitStatus?.initialized ? gitStatus.branch : ''}
          gitDirtyCount={gitStatus?.files.length || 0}
          interpreterLabel={interpreterLabel}
          diagnostics={diagnostics}
          onToggleLanguage={() => {
            if (!activeTab) return;
            const nextLang: LanguageMode =
              activeTab.language === 'pyid' ? 'python' : 'pyid';
            setTabs((prev) =>
              prev.map((t) =>
                t.path === activeTab.path ? { ...t, language: nextLang } : t
              )
            );
          }}
          onToggleLineEnding={() => {
            if (!activeTab) return;
            const nextLe = activeTab.lineEnding === 'LF' ? 'CRLF' : 'LF';
            setTabs((prev) =>
              prev.map((t) =>
                t.path === activeTab.path
                  ? { ...t, lineEnding: nextLe, isDirty: true }
                  : t
              )
            );
          }}
          onToggleEncoding={() => {
            if (!activeTab) return;
            const order = ['UTF-8', 'UTF-8 BOM', 'ASCII'] as const;
            const idx = (order.indexOf(activeTab.encoding) + 1) % order.length;
            setTabs((prev) =>
              prev.map((t) =>
                t.path === activeTab.path ? { ...t, encoding: order[idx] } : t
              )
            );
          }}
          onOpenProblems={() => {
            setBottomOpen(true);
            setBottomTab('problems');
          }}
          onOpenGit={() => {
            setSidebarOpen(true);
            setActiveView('git');
          }}
          onOpenPackages={() => {
            setBottomOpen(true);
            setBottomTab('packages');
          }}
        />
      )}

      {/* Mobile Touch Navigation & Coding Keyboard Toolbar */}
      <MobileToolbar
        activePane={mobilePane}
        onSelectPane={(pane) => {
          setMobilePane(pane);
          if (pane === 'terminal') {
            setBottomOpen(true);
            setBottomTab('terminal');
          }
        }}
        onRun={() => {
          setMobilePane('terminal');
          setBottomOpen(true);
          setBottomTab('output');
          handleRunActive();
        }}
        onInsertSnippet={(text) => editorApiRef.current?.insertText(text)}
        onUndo={() => editorApiRef.current?.undo()}
        onRedo={() => editorApiRef.current?.redo()}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-14 md:bottom-9 right-4 z-50 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-[#0d1526] text-white border border-teal-500/40 shadow-lg text-xs"
        >
          {toastMsg}
        </div>
      )}

      {/* Modals */}
      <CommandPaletteModal
        open={paletteOpen}
        commands={paletteCommands}
        onClose={() => setPaletteOpen(false)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onUpdate={updateSettings}
        onExportBackup={() => {
          const payload = JSON.stringify(
            {
              type: 'condo-backup',
              version: '1.0',
              settings,
              extensions,
              snippets,
            },
            null,
            2
          );
          downloadBlobFile('condo-settings-backup.cdopack', payload);
          notify('Exported settings & extensions backup.');
        }}
        onImportBackup={async (file) => {
          try {
            const parsed = JSON.parse(await file.text());
            if (parsed.settings) updateSettings({ ...settings, ...parsed.settings });
            if (Array.isArray(parsed.extensions)) {
              setExtensions(parsed.extensions);
              saveExtensions(parsed.extensions);
            }
            notify('Restored settings backup.');
          } catch {
            notify('Invalid backup file.');
          }
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <TemplatesModal
        open={templatesOpen}
        onCreateWorkspace={handleCreateWorkspace}
        onClose={() => setTemplatesOpen(false)}
      />

      <PyIdReferenceModal open={refOpen} onClose={() => setRefOpen(false)} />

      <GoToLineModal
        open={goToLineOpen}
        onGo={(line) => editorApiRef.current?.goToLine(line, 1)}
        onClose={() => setGoToLineOpen(false)}
      />
    </div>
  );
}
