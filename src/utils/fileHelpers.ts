import type { LanguageMode } from '../shared/types';

export function detectLanguageFromFilename(
  filename: string,
  defaultMode: 'pyid' | 'python' = 'pyid'
): LanguageMode {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.cdo')) return 'pyid';
  if (lower.endsWith('.py')) return 'python';
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.cdoproj') ||
    lower.endsWith('.cdotheme') ||
    lower.endsWith('.cdosnippet') ||
    lower.endsWith('.cdopack')
  ) {
    return 'json';
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.gitignore') || lower === '.gitignore') return 'gitignore';
  if (lower.endsWith('.txt')) return 'plaintext';
  return defaultMode;
}

export function getFileBadgeText(name: string): { label: string; colorClass: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.cdo')) return { label: 'CDO', colorClass: 'text-teal-400' };
  if (lower.endsWith('.py')) return { label: 'PY', colorClass: 'text-sky-400' };
  if (lower.endsWith('.cdoproj')) return { label: 'PRJ', colorClass: 'text-amber-400' };
  if (lower.endsWith('.cdotheme')) return { label: 'THM', colorClass: 'text-cyan-400' };
  if (lower.endsWith('.cdosnippet')) return { label: 'SNP', colorClass: 'text-indigo-400' };
  if (lower.endsWith('.cdopack')) return { label: 'PCK', colorClass: 'text-emerald-400' };
  if (lower.endsWith('.json')) return { label: 'JSN', colorClass: 'text-amber-300' };
  if (lower.endsWith('.md')) return { label: 'MD', colorClass: 'text-slate-400' };
  return { label: 'TXT', colorClass: 'text-slate-400' };
}

export function isEditableCodeFile(lang: LanguageMode): boolean {
  return lang === 'pyid' || lang === 'python';
}
