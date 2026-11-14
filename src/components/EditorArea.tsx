import React, { useEffect, useMemo, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { marked } from 'marked';
import {
  ChevronRight,
  Columns2,
  Eye,
  FileCode,
  Maximize2,
  Minimize2,
  Play,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import type {
  CondoTheme,
  DiagnosticItem,
  EditorTab,
  IdeSettings,
  LanguageMode,
} from '../shared/types';
import {
  applyCondoMonacoTheme,
  registerCondoMonacoLanguages,
} from '../utils/monacoPyid';
import { getFileBadgeText } from '../utils/fileHelpers';

// Configure Monaco loader to use locally bundled monaco-editor (no external CDN needed)
loader.config({ monaco });

interface EditorAreaProps {
  workspaceName: string;
  tabs: EditorTab[];
  activeTabPath: string | null;
  splitTabPath: string | null;
  settings: IdeSettings;
  activeTheme: CondoTheme;
  diagnostics: DiagnosticItem[];
  breakpoints: Record<string, number[]>;
  pausedLocation: { file?: string; line?: number } | null;
  isFullscreen: boolean;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, content: string) => void;
  onChangeLanguage: (path: string, lang: LanguageMode) => void;
  onTogglePreview: (path: string) => void;
  onToggleSplit: () => void;
  onSelectSplitTab: (path: string) => void;
  onToggleBreakpoint: (file: string, line: number) => void;
  onCursorChange: (line: number, column: number) => void;
  onFormatDocument: () => void;
  onRunSelection: (selectedCode: string) => void;
  onExportPython: (path: string) => void;
  onToggleFullscreen: () => void;
  onEditorReady: (api: {
    goToLine: (line: number, column?: number) => void;
    insertText: (text: string) => void;
    triggerAction: (actionId: string) => void;
    undo: () => void;
    redo: () => void;
  }) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  workspaceName,
  tabs,
  activeTabPath,
  splitTabPath,
  settings,
  activeTheme,
  diagnostics,
  breakpoints,
  pausedLocation,
  isFullscreen,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onChangeLanguage,
  onTogglePreview,
  onToggleSplit,
  onSelectSplitTab,
  onToggleBreakpoint,
  onCursorChange,
  onFormatDocument,
  onRunSelection,
  onExportPython,
  onToggleFullscreen,
  onEditorReady,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const bpDecorationsRef = useRef<string[]>([]);
  const activeTabPathRef = useRef<string | null>(activeTabPath);
  const onToggleBreakpointRef = useRef(onToggleBreakpoint);

  activeTabPathRef.current = activeTabPath;
  onToggleBreakpointRef.current = onToggleBreakpoint;

  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activeTabPath) || null,
    [tabs, activeTabPath]
  );

  const splitTab = useMemo(
    () => (splitTabPath ? tabs.find((t) => t.path === splitTabPath) || null : null),
    [tabs, splitTabPath]
  );

  // Apply theme dynamically
  useEffect(() => {
    if (monacoRef.current) {
      applyCondoMonacoTheme(monacoRef.current, activeTheme);
    }
  }, [activeTheme]);

  // Update diagnostics markers in Monaco
  useEffect(() => {
    const ed = editorRef.current;
    const m = monacoRef.current;
    if (!ed || !m || !activeTab) return;
    const model = ed.getModel();
    if (!model) return;

    const fileDiags = diagnostics.filter((d) => d.file === activeTab.path);
    const markers: monaco.editor.IMarkerData[] = fileDiags.map((d) => ({
      startLineNumber: Math.max(1, d.line),
      startColumn: Math.max(1, d.column),
      endLineNumber: Math.max(1, d.line),
      endColumn: Math.max(1, d.column + 10),
      message: `${d.message} (${d.source})`,
      severity:
        d.severity === 'error'
          ? m.MarkerSeverity.Error
          : d.severity === 'warning'
          ? m.MarkerSeverity.Warning
          : m.MarkerSeverity.Info,
    }));
    m.editor.setModelMarkers(model, 'condo', markers);
  }, [diagnostics, activeTab]);

  // Update breakpoint & paused debug line decorations
  useEffect(() => {
    const ed = editorRef.current;
    const m = monacoRef.current;
    if (!ed || !m || !activeTab) return;

    const bps = breakpoints[activeTab.path] || [];
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = bps.map((line) => ({
      range: new m.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'condo-bp-glyph',
        glyphMarginHoverMessage: { value: `Breakpoint at line ${line}` },
        linesDecorationsClassName: 'bg-rose-500/80 w-1.5 rounded-full ml-1',
      },
    }));

    if (pausedLocation?.file === activeTab.path && pausedLocation.line) {
      newDecorations.push({
        range: new m.Range(pausedLocation.line, 1, pausedLocation.line, 1),
        options: {
          isWholeLine: true,
          className: 'bg-amber-500/20',
        },
      });
    }

    bpDecorationsRef.current = ed.deltaDecorations(
      bpDecorationsRef.current,
      newDecorations
    );
  }, [breakpoints, pausedLocation, activeTab]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    registerCondoMonacoLanguages(monacoInstance);
    applyCondoMonacoTheme(monacoInstance, activeTheme);

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange(e.position.lineNumber, e.position.column);
    });

    // Toggle breakpoint on gutter/line-number click
    editor.onMouseDown((e) => {
      if (
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_LINE_DECORATIONS
      ) {
        const line = e.target.position?.lineNumber;
        if (line && activeTabPathRef.current) {
          onToggleBreakpointRef.current(activeTabPathRef.current, line);
        }
      }
    });

    // Context menu action: Run Selected Code
    editor.addAction({
      id: 'condo.runSelection',
      label: 'CONDO: Run Selected Code',
      contextMenuGroupId: 'navigation',
      run: (ed) => {
        const sel = ed.getSelection();
        if (!sel) return;
        const text = ed.getModel()?.getValueInRange(sel);
        if (text && text.trim()) {
          onRunSelection(text);
        }
      },
    });

    onEditorReady({
      goToLine: (line, column = 1) => {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column });
        editor.focus();
      },
      insertText: (text) => {
        const sel = editor.getSelection();
        if (sel) {
          editor.executeEdits('condo', [{ range: sel, text, forceMoveMarkers: true }]);
          editor.focus();
        }
      },
      triggerAction: (actionId) => {
        editor.focus();
        editor.trigger('condo-menu', actionId, null);
      },
      undo: () => {
        editor.trigger('condo-toolbar', 'undo', null);
      },
      redo: () => {
        editor.trigger('condo-toolbar', 'redo', null);
      },
    });
  };

  const markdownHtml = useMemo(() => {
    if (!activeTab || activeTab.language !== 'markdown' || !activeTab.previewMode) {
      return '';
    }
    return marked.parse(activeTab.content) as string;
  }, [activeTab]);

  const parsedJsonPreview = useMemo(() => {
    if (!activeTab || activeTab.language !== 'json' || !activeTab.previewMode) {
      return null;
    }
    try {
      return { ok: true, data: JSON.parse(activeTab.content) };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Invalid JSON' };
    }
  }, [activeTab]);

  if (tabs.length === 0 || !activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#0d1526] text-slate-500 dark:text-slate-400">
        <div className="max-w-md space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <FileCode className="w-6 h-6 text-teal-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            CONDO IDE
          </h2>
          <p className="text-xs leading-relaxed">
            Write. Run. Build. Create. Select a file from the Explorer on the left,
            create a new <span className="font-mono text-teal-400">.cdo</span> or{' '}
            <span className="font-mono text-sky-400">.py</span> file, or open the Command
            Palette with <span className="font-mono">Ctrl+Shift+P</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#0d1526]">
      {/* Tab Bar */}
      <div className="flex items-center justify-between bg-slate-100 dark:bg-[#070c18] border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        <div
          role="tablist"
          aria-label="Open editor tabs"
          className="flex items-center overflow-x-auto no-scrollbar min-w-0 flex-1"
        >
          {tabs.map((tab) => {
            const active = tab.path === activeTab.path;
            const badge = getFileBadgeText(tab.name);
            return (
              <div
                key={tab.path}
                className={`group flex items-center gap-1.5 px-3 py-2 border-r border-slate-200 dark:border-slate-800/80 text-xs shrink-0 transition-colors ${
                  active
                    ? 'bg-white dark:bg-[#0d1526] text-slate-900 dark:text-slate-100 border-t-2 border-t-teal-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectTab(tab.path)}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className={`font-mono text-[9px] font-bold ${badge.colorClass}`}>
                    {badge.label}
                  </span>
                  <span>{tab.name}</span>
                  {tab.isDirty && (
                    <span
                      aria-label="Unsaved changes"
                      className="text-amber-500 font-bold"
                    >
                      •
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onCloseTab(tab.path)}
                  aria-label={`Close ${tab.name}`}
                  className="p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-slate-300/60 dark:hover:bg-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Editor Toolbar Actions */}
        <div className="flex items-center gap-1 px-2 shrink-0">
          {(activeTab.language === 'pyid' || activeTab.language === 'python') && (
            <>
              <button
                type="button"
                onClick={() =>
                  onChangeLanguage(
                    activeTab.path,
                    activeTab.language === 'pyid' ? 'python' : 'pyid'
                  )
                }
                title="Switch PyID / Python Syntax Mode"
                className="px-2 py-1 rounded text-[11px] font-mono font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 whitespace-nowrap"
              >
                {activeTab.language === 'pyid' ? 'Mode: PyID' : 'Mode: Python'}
              </button>
              <button
                type="button"
                onClick={() => onExportPython(activeTab.path)}
                title="Export to .py file"
                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3 text-cyan-500" />
                <span>Export .py</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const ed = editorRef.current;
                  const sel = ed?.getSelection();
                  const text = sel ? ed?.getModel()?.getValueInRange(sel) : '';
                  if (text && text.trim()) onRunSelection(text);
                }}
                title="Run Selected Code"
                className="hidden lg:flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Play className="w-3 h-3 text-teal-500" />
                <span>Run Selection</span>
              </button>
            </>
          )}

          {(activeTab.language === 'markdown' || activeTab.language === 'json') && (
            <button
              type="button"
              onClick={() => onTogglePreview(activeTab.path)}
              aria-label="Toggle preview"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap ${
                activeTab.previewMode
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{activeTab.previewMode ? 'Code' : 'Preview'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onFormatDocument}
            aria-label="Format document"
            title="Format Document (Shift+Alt+F)"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </button>

          {tabs.length > 1 && (
            <button
              type="button"
              onClick={onToggleSplit}
              aria-label="Toggle split editor"
              title="Split Editor Right"
              className={`hidden md:flex p-1.5 rounded ${
                splitTab
                  ? 'bg-teal-500/20 text-teal-500'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen editor' : 'Fullscreen editor'}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Editor'}
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0b1222] shrink-0 overflow-x-auto whitespace-nowrap">
        <span>{workspaceName}</span>
        {activeTab.path.split('/').map((seg, idx, arr) => (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span
              className={
                idx === arr.length - 1
                  ? 'text-slate-800 dark:text-slate-200 font-medium'
                  : ''
              }
            >
              {seg}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Editor / Split / Preview Body */}
      <div className="flex-1 flex min-h-0 min-w-0">
        {/* Primary Pane */}
        <div className="flex-1 min-w-0 min-h-0 relative">
          {activeTab.previewMode && activeTab.language === 'markdown' ? (
            <div
              className="h-full overflow-y-auto p-6 prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          ) : activeTab.previewMode && activeTab.language === 'json' ? (
            <div className="h-full overflow-y-auto p-4 font-mono text-xs">
              {parsedJsonPreview?.ok ? (
                <pre className="p-4 rounded-lg bg-slate-100 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-teal-300 overflow-x-auto">
                  {JSON.stringify(parsedJsonPreview.data, null, 2)}
                </pre>
              ) : (
                <div className="p-4 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/30">
                  {parsedJsonPreview?.error}
                </div>
              )}
            </div>
          ) : (
            <Editor
              height="100%"
              path={`condo:///${activeTab.path}`}
              language={
                activeTab.language === 'gitignore' ? 'plaintext' : activeTab.language
              }
              value={activeTab.content}
              onChange={(val) => onChangeContent(activeTab.path, val ?? '')}
              onMount={handleEditorMount}
              options={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: settings.fontSize,
                tabSize: settings.tabSize,
                wordWrap: settings.wordWrap ? 'on' : 'off',
                minimap: {
                  enabled:
                    settings.minimap &&
                    (typeof window === 'undefined' || window.innerWidth >= 768),
                },
                lineNumbers: settings.lineNumbers ? 'on' : 'off',
                glyphMargin: true,
                folding: true,
                automaticLayout: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoIndent: 'full',
                multiCursorModifier: 'ctrlCmd',
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                padding: { top: 10 },
              }}
            />
          )}
        </div>

        {/* Split Secondary Pane */}
        {splitTab && (
          <div className="hidden md:flex flex-col flex-1 min-w-0 min-h-0 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-3 py-1 bg-slate-100 dark:bg-[#090f1d] border-b border-slate-200 dark:border-slate-800 text-xs">
              <select
                aria-label="Select file for split editor pane"
                value={splitTab.path}
                onChange={(e) => onSelectSplitTab(e.target.value)}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-200 outline-none"
              >
                {tabs.map((t) => (
                  <option key={t.path} value={t.path} className="dark:bg-[#0d1526]">
                    {t.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onToggleSplit}
                aria-label="Close split editor"
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                path={`condo-split:///${splitTab.path}`}
                language={
                  splitTab.language === 'gitignore' ? 'plaintext' : splitTab.language
                }
                value={splitTab.content}
                onChange={(val) => onChangeContent(splitTab.path, val ?? '')}
                options={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: settings.fontSize,
                  tabSize: settings.tabSize,
                  wordWrap: settings.wordWrap ? 'on' : 'off',
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 10 },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
