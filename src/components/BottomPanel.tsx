import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Info,
  Package,
  Plus,
  Send,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BottomTab,
  DiagnosticItem,
  OutputLine,
} from '../shared/types';

interface TerminalInstance {
  id: string;
  label: string;
  mode: 'bash' | 'python';
}

interface PythonEnvInfo {
  versionLabel: string;
  executable: string;
  version: string;
  packages: Array<{ name: string; version: string }>;
  pipAvailable: boolean;
  hasVenv: boolean;
}

interface BottomPanelProps {
  workspaceId: string;
  activeTab: BottomTab;
  themeMode: 'dark' | 'light';
  outputLines: OutputLine[];
  diagnostics: DiagnosticItem[];
  debugLogs: string[];
  isRunning: boolean;
  isDebugPaused: boolean;
  height: number;
  onSelectTab: (tab: BottomTab) => void;
  onClosePanel: () => void;
  onSendRuntimeStdin: (text: string) => void;
  onClearOutput: () => void;
  onJumpToLocation: (file: string, line: number, col?: number) => void;
  onEvalDebugExpr: (expr: string) => void;
  onNotify: (msg: string) => void;
}

const XTermView: React.FC<{
  workspaceId: string;
  session: TerminalInstance;
  themeMode: 'dark' | 'light';
  visible: boolean;
}> = ({ workspaceId, session, themeMode, visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme:
        themeMode === 'dark'
          ? {
              background: '#070b15',
              foreground: '#e2e8f0',
              cursor: '#14b8a6',
              selectionBackground: 'rgba(20, 184, 166, 0.3)',
            }
          : {
              background: '#f8fafc',
              foreground: '#0f172a',
              cursor: '#0d9488',
              selectionBackground: 'rgba(13, 148, 136, 0.2)',
            },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    setTimeout(() => fit.fit(), 30);

    termRef.current = term;
    fitRef.current = fit;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/terminal?workspaceId=${encodeURIComponent(
      workspaceId
    )}&sessionId=${encodeURIComponent(session.id)}&mode=${session.mode}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'data') {
          term.write(msg.data);
        } else if (msg.type === 'exit') {
          term.writeln(`\r\n[Process exited with code ${msg.code}]`);
        }
      } catch {
        // ignore
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })
          );
        }
      } catch {
        // ignore resize errors when hidden
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [workspaceId, session.id, session.mode]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme =
        themeMode === 'dark'
          ? {
              background: '#070b15',
              foreground: '#e2e8f0',
              cursor: '#14b8a6',
              selectionBackground: 'rgba(20, 184, 166, 0.3)',
            }
          : {
              background: '#f8fafc',
              foreground: '#0f172a',
              cursor: '#0d9488',
              selectionBackground: 'rgba(13, 148, 136, 0.2)',
            };
      termRef.current.refresh(0, termRef.current.rows - 1);
    }
  }, [themeMode]);

  useEffect(() => {
    if (visible && fitRef.current) {
      setTimeout(() => fitRef.current?.fit(), 40);
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full bg-[#f8fafc] dark:bg-[#070b15] ${visible ? 'block' : 'hidden'}`}
      data-testid={`xterm-${session.id}`}
    />
  );
};

export const BottomPanel: React.FC<BottomPanelProps> = ({
  workspaceId,
  activeTab,
  themeMode,
  outputLines,
  diagnostics,
  debugLogs,
  isRunning,
  isDebugPaused,
  height,
  onSelectTab,
  onClosePanel,
  onSendRuntimeStdin,
  onClearOutput,
  onJumpToLocation,
  onEvalDebugExpr,
  onNotify,
}) => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: 'bash-1', label: 'bash', mode: 'bash' },
  ]);
  const [activeTermId, setActiveTermId] = useState('bash-1');
  const [stdinInput, setStdinInput] = useState('');
  const [debugExpr, setDebugExpr] = useState('');

  // Packages state
  const [pyEnv, setPyEnv] = useState<PythonEnvInfo | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgOutput, setPkgOutput] = useState('');
  const [pkgBusy, setPkgBusy] = useState(false);

  const outputScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputScrollRef.current) {
      outputScrollRef.current.scrollTop = outputScrollRef.current.scrollHeight;
    }
  }, [outputLines]);

  const loadPyEnv = async () => {
    try {
      const res = await fetch(`/api/python/${workspaceId}/env`);
      const data = await res.json();
      if (res.ok) setPyEnv(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab === 'packages') {
      loadPyEnv();
    }
  }, [activeTab, workspaceId]);

  const addTerminal = (mode: 'bash' | 'python') => {
    const id = `${mode}-${Date.now().toString(36)}`;
    const count = terminals.filter((t) => t.mode === mode).length + 1;
    const label = mode === 'python' ? `python3 (${count})` : `bash (${count})`;
    setTerminals((prev) => [...prev, { id, label, mode }]);
    setActiveTermId(id);
  };

  const closeTerminal = (id: string) => {
    setTerminals((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh: TerminalInstance = {
          id: `bash-${Date.now().toString(36)}`,
          label: 'bash',
          mode: 'bash',
        };
        setActiveTermId(fresh.id);
        return [fresh];
      }
      if (activeTermId === id) {
        setActiveTermId(next[0].id);
      }
      return next;
    });
  };

  const runPkgAction = async (
    endpoint: 'venv' | 'pip',
    body: Record<string, unknown> = {}
  ) => {
    setPkgBusy(true);
    try {
      const res = await fetch(`/api/python/${workspaceId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setPkgOutput(data.output || (data.ok ? 'Done.' : 'Failed.'));
      onNotify(data.ok ? 'Python environment updated.' : 'Package command returned an error.');
      loadPyEnv();
    } finally {
      setPkgBusy(false);
    }
  };

  const errorsCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningsCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <section
      aria-label="Bottom Workbench Panel"
      style={{ height: `${height}px` }}
      className="shrink-0 flex flex-col border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b15] text-xs"
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-2 border-b border-slate-200 dark:border-slate-800/90 bg-slate-100 dark:bg-[#080d1a] shrink-0 overflow-x-auto">
        <div role="tablist" className="flex items-center gap-1">
          {(
            [
              { id: 'terminal', label: 'Terminal' },
              { id: 'output', label: 'Output' },
              {
                id: 'problems',
                label: `Problems (${errorsCount + warningsCount})`,
              },
              { id: 'debug-console', label: 'Debug Console' },
              { id: 'packages', label: 'Packages & Venv' },
            ] as Array<{ id: BottomTab; label: string }>
          ).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeTab === 'terminal' && (
            <>
              <button
                type="button"
                onClick={() => addTerminal('bash')}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                <span>Bash</span>
              </button>
              <button
                type="button"
                onClick={() => addTerminal('python')}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] text-teal-600 dark:text-teal-400 whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                <span>Python REPL</span>
              </button>
            </>
          )}
          {activeTab === 'output' && (
            <button
              type="button"
              onClick={onClearOutput}
              aria-label="Clear output"
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClosePanel}
            aria-label="Hide bottom panel"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 1. Real Interactive XTerm Terminals */}
        <div
          className={`flex-1 flex min-w-0 min-h-0 ${
            activeTab === 'terminal' ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex-1 min-w-0 min-h-0">
            {terminals.map((sess) => (
              <XTermView
                key={sess.id}
                workspaceId={workspaceId}
                session={sess}
                themeMode={themeMode}
                visible={activeTab === 'terminal' && activeTermId === sess.id}
              />
            ))}
          </div>
          <div className="hidden sm:block sm:w-36 md:w-40 border-l border-slate-200 dark:border-slate-800 p-1.5 space-y-1 overflow-y-auto shrink-0">
            {terminals.map((sess) => (
              <div
                key={sess.id}
                className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${
                  activeTermId === sess.id
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTermId(sess.id)}
                  className="flex items-center gap-1.5 truncate flex-1 text-left"
                >
                  <TerminalIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{sess.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => closeTerminal(sess.id)}
                  aria-label={`Close terminal ${sess.label}`}
                  className="p-0.5 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Output Panel + Live Stdin */}
        {activeTab === 'output' && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div
              ref={outputScrollRef}
              data-testid="runtime-output"
              className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5"
            >
              {outputLines.length === 0 ? (
                <div className="text-slate-400">
                  Click Run to execute your Python (.py) or PyID (.cdo) program with CPython.
                </div>
              ) : (
                outputLines.map((line) => {
                  const match = /File "([^"]+)", line (\d+)/.exec(line.text);
                  return (
                    <div
                      key={line.id}
                      className={`whitespace-pre-wrap break-words ${
                        line.stream === 'stderr'
                          ? 'text-rose-500 dark:text-rose-400'
                          : line.stream === 'system'
                          ? 'text-teal-600 dark:text-teal-400'
                          : line.stream === 'input'
                          ? 'text-amber-500'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {line.text}
                      {match && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToLocation(match[1], Number(match[2]))
                          }
                          className="ml-2 underline text-cyan-500 hover:text-cyan-400"
                        >
                          Jump to {match[1]}:{match[2]}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isRunning) return;
                onSendRuntimeStdin(stdinInput);
                setStdinInput('');
              }}
              className="flex items-center gap-2 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090f1d]"
            >
              <span className="font-mono text-[11px] text-slate-400 shrink-0">
                stdin &gt;
              </span>
              <input
                type="text"
                disabled={!isRunning}
                value={stdinInput}
                onChange={(e) => setStdinInput(e.target.value)}
                placeholder={
                  isRunning
                    ? 'Type input for masukan() / input() and press Enter...'
                    : 'Program is not currently running'
                }
                aria-label="Program standard input"
                className="flex-1 bg-transparent outline-none font-mono text-xs disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isRunning}
                className="px-2.5 py-1 rounded bg-teal-600 text-white text-[11px] font-medium disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* 3. Problems Panel */}
        {activeTab === 'problems' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {diagnostics.length === 0 ? (
              <div className="p-4 text-slate-400">
                No problems detected in the open editor files.
              </div>
            ) : (
              diagnostics.map((d, idx) => (
                <button
                  key={`${d.file}-${d.line}-${idx}`}
                  type="button"
                  onClick={() => onJumpToLocation(d.file, d.line, d.column)}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800/70 flex items-center gap-2"
                >
                  {d.severity === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : d.severity === 'warning' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  )}
                  <span className="flex-1 truncate text-slate-800 dark:text-slate-200">
                    {d.message}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                    {d.file}:{d.line}:{d.column}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* 4. Debug Console */}
        {activeTab === 'debug-console' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
              {debugLogs.length === 0 ? (
                <div className="text-slate-400">
                  Start debugging to evaluate Python expressions in the paused frame.
                </div>
              ) : (
                debugLogs.map((l, idx) => (
                  <div key={idx} className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                    {l}
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!debugExpr.trim() || !isDebugPaused) return;
                onEvalDebugExpr(debugExpr.trim());
                setDebugExpr('');
              }}
              className="flex items-center gap-2 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090f1d]"
            >
              <span className="font-mono text-teal-500">&gt;&gt;&gt;</span>
              <input
                type="text"
                disabled={!isDebugPaused}
                value={debugExpr}
                onChange={(e) => setDebugExpr(e.target.value)}
                placeholder={
                  isDebugPaused
                    ? 'Evaluate expression in current debug frame...'
                    : 'Pause debugger at a breakpoint to evaluate expressions'
                }
                aria-label="Debug console expression"
                className="flex-1 bg-transparent outline-none font-mono text-xs disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isDebugPaused || !debugExpr.trim()}
                aria-label="Evaluate debug expression"
                className="p-1 rounded bg-teal-600 text-white disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* 5. Packages & Venv Manager */}
        {activeTab === 'packages' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-teal-500" />
                  <span>{pyEnv?.versionLabel || 'Loading Python environment...'}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {pyEnv?.executable} · pip: {pyEnv?.pipAvailable ? 'available' : 'not installed'}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pkgBusy}
                  onClick={() => runPkgAction('venv')}
                  className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-teal-600 hover:text-white text-xs font-medium"
                >
                  {pyEnv?.hasVenv ? 'Rebuild .venv' : 'Create .venv'}
                </button>
                <button
                  type="button"
                  disabled={pkgBusy}
                  onClick={() => runPkgAction('pip', { action: 'install-req' })}
                  className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium"
                >
                  Install requirements.txt
                </button>
              </div>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="Package name (e.g. requests)"
                aria-label="Python package name"
                className="flex-1 px-2.5 py-1 rounded bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs font-mono"
              />
              <button
                type="button"
                disabled={pkgBusy || !pkgName.trim()}
                onClick={() => runPkgAction('pip', { action: 'install', pkg: pkgName })}
                className="px-3 py-1 rounded bg-teal-600 text-white font-medium disabled:opacity-40"
              >
                pip install
              </button>
            </div>

            {pkgOutput && (
              <pre className="p-2 rounded bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-slate-800 font-mono text-[11px] whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                {pkgOutput}
              </pre>
            )}

            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Installed Distributions ({pyEnv?.packages.length || 0})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {pyEnv?.packages.map((p) => (
                  <div
                    key={p.name}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 font-mono text-[11px]"
                  >
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {p.name}
                    </span>
                    <span className="text-slate-400 shrink-0">{p.version}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
