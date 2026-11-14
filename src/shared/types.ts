export type LanguageMode = 'pyid' | 'python' | 'json' | 'markdown' | 'plaintext' | 'gitignore';

export type LineEnding = 'LF' | 'CRLF';
export type FileEncoding = 'UTF-8' | 'UTF-8 BOM' | 'ASCII';

export interface FileNode {
  name: string;
  path: string; // relative path from workspace root using '/'
  type: 'file' | 'folder';
  size?: number;
  modifiedAt?: number;
  children?: FileNode[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  defaultLanguage: 'pyid' | 'python';
  localFolderName?: string;
}

export interface CondoProjectConfig {
  name: string;
  version: string;
  entryPoint: string;
  mode: 'pyid' | 'python';
  interpreter: string;
  env: Record<string, string>;
  tasks: Array<{ name: string; command: string }>;
}

export interface CondoTheme {
  id: string;
  name: string;
  author: string;
  type: 'dark' | 'light';
  colors: {
    bg: string;
    sidebarBg: string;
    editorBg: string;
    panelBg: string;
    accent: string;
    text: string;
    mutedText: string;
    border: string;
    keyword: string;
    string: string;
    comment: string;
    number: string;
    function: string;
  };
}

export interface CondoSnippet {
  id: string;
  prefix: string;
  label: string;
  language: 'pyid' | 'python' | 'all';
  body: string;
  description: string;
}

export type ExtensionPermission =
  | 'editor:read'
  | 'editor:write'
  | 'snippets:register'
  | 'theme:register'
  | 'commands:register'
  | 'workspace:read';

export interface CondoExtension {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: 'Language' | 'Theme' | 'Tools' | 'Snippets' | 'Productivity';
  permissions: ExtensionPermission[];
  installed: boolean;
  enabled: boolean;
  settings: Record<string, string | boolean | number>;
  snippets?: CondoSnippet[];
  theme?: CondoTheme;
  commands?: Array<{ id: string; title: string; insertText?: string }>;
}

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  language: LanguageMode;
  encoding: FileEncoding;
  lineEnding: LineEnding;
  isDirty: boolean;
  pinned?: boolean;
  previewMode?: boolean; // for Markdown / JSON preview
}

export interface DiagnosticItem {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export interface DebugVariable {
  name: string;
  value: string;
  type: string;
}

export interface DebugFrame {
  id: number;
  name: string;
  file: string;
  line: number;
}

export interface DebugState {
  status: 'idle' | 'running' | 'paused' | 'stopped';
  file?: string;
  line?: number;
  frames: DebugFrame[];
  locals: DebugVariable[];
  globals: DebugVariable[];
  watchResults: Array<{ expression: string; value: string; error?: string }>;
}

export interface GitFileStatus {
  path: string;
  indexStatus: string;
  workingStatus: string;
  staged: boolean;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitStatusResponse {
  initialized: boolean;
  branch: string;
  branches: string[];
  files: GitFileStatus[];
  commits: GitCommit[];
  remoteUrl?: string;
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}

export interface IdeSettings {
  themeMode: 'dark' | 'light';
  activeThemeId: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveDelayMs: number;
  defaultLanguageMode: 'pyid' | 'python';
  defaultEncoding: FileEncoding;
  defaultLineEnding: LineEnding;
  interpreter: string;
}

export interface OutputLine {
  id: string;
  stream: 'stdout' | 'stderr' | 'system' | 'input';
  text: string;
  timestamp: number;
  file?: string;
  line?: number;
}

export type ActivityView =
  | 'explorer'
  | 'search'
  | 'git'
  | 'debug'
  | 'extensions'
  | 'ai';

export type BottomTab =
  | 'terminal'
  | 'output'
  | 'problems'
  | 'debug-console'
  | 'packages';
