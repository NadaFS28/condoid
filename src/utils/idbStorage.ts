import type { CondoExtension, CondoSnippet, CondoTheme, IdeSettings } from '../shared/types';
import { BUILTIN_EXTENSIONS, BUILTIN_SNIPPETS, BUILTIN_THEMES } from '../shared/templates';

const DB_NAME = 'condo-ide-db';
const DB_VERSION = 1;
const STORE_KV = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const store = tx.objectStore(STORE_KV);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      const store = tx.objectStore(STORE_KV);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage quota / unavailable errors
  }
}

export const DEFAULT_SETTINGS: IdeSettings = {
  themeMode: 'dark',
  activeThemeId: 'condo-navy-teal',
  fontSize: 14,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  lineNumbers: true,
  autoSave: true,
  autoSaveDelayMs: 1200,
  defaultLanguageMode: 'pyid',
  defaultEncoding: 'UTF-8',
  defaultLineEnding: 'LF',
  interpreter: 'python3',
};

export interface RecoverySession {
  workspaceId: string;
  openTabs: Array<{ path: string; content: string; isDirty: boolean }>;
  activeTabPath: string | null;
  savedAt: number;
}

export async function loadSettings(): Promise<IdeSettings> {
  const saved = await idbGet<Partial<IdeSettings>>('settings');
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

export async function saveSettings(settings: IdeSettings): Promise<void> {
  await idbSet('settings', settings);
}

export async function loadRecoverySession(): Promise<RecoverySession | null> {
  return idbGet<RecoverySession>('recovery_session');
}

export async function saveRecoverySession(session: RecoverySession): Promise<void> {
  await idbSet('recovery_session', session);
}

export async function loadExtensions(): Promise<CondoExtension[]> {
  const saved = await idbGet<CondoExtension[]>('extensions');
  if (!saved || !Array.isArray(saved) || saved.length === 0) {
    return BUILTIN_EXTENSIONS;
  }
  return saved;
}

export async function saveExtensions(exts: CondoExtension[]): Promise<void> {
  await idbSet('extensions', exts);
}

export async function loadCustomThemes(): Promise<CondoTheme[]> {
  const saved = await idbGet<CondoTheme[]>('custom_themes');
  return [...BUILTIN_THEMES, ...(saved || [])];
}

export async function saveCustomThemes(themes: CondoTheme[]): Promise<void> {
  const builtinIds = new Set(BUILTIN_THEMES.map((t) => t.id));
  await idbSet(
    'custom_themes',
    themes.filter((t) => !builtinIds.has(t.id))
  );
}

export async function loadCustomSnippets(): Promise<CondoSnippet[]> {
  const saved = await idbGet<CondoSnippet[]>('custom_snippets');
  return [...BUILTIN_SNIPPETS, ...(saved || [])];
}

export async function saveCustomSnippets(snippets: CondoSnippet[]): Promise<void> {
  const builtinIds = new Set(BUILTIN_SNIPPETS.map((s) => s.id));
  await idbSet(
    'custom_snippets',
    snippets.filter((s) => !builtinIds.has(s.id))
  );
}

export async function loadRecentFiles(): Promise<string[]> {
  return (await idbGet<string[]>('recent_files')) || [];
}

export async function pushRecentFile(filePath: string): Promise<string[]> {
  const cur = await loadRecentFiles();
  const next = [filePath, ...cur.filter((p) => p !== filePath)].slice(0, 15);
  await idbSet('recent_files', next);
  return next;
}
