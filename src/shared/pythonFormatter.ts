import type { DiagnosticItem, LanguageMode } from './types';
import { transpilePyIdToPython } from './pyidTranspiler';

/**
 * Formats Python / PyID / JSON code cleanly.
 */
export function formatCode(source: string, language: LanguageMode): string {
  if (language === 'json') {
    try {
      const parsed = JSON.parse(source);
      return JSON.stringify(parsed, null, 2) + '\n';
    } catch {
      return source;
    }
  }

  if (language !== 'python' && language !== 'pyid') {
    return source;
  }

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const formatted: string[] = [];
  let consecutiveBlank = 0;

  for (const rawLine of lines) {
    // Convert leading tabs to 4 spaces
    const expanded = rawLine.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length));
    const trimmedRight = expanded.replace(/[ \t]+$/g, '');

    if (trimmedRight.length === 0) {
      consecutiveBlank++;
      if (consecutiveBlank <= 2) {
        formatted.push('');
      }
      continue;
    }
    consecutiveBlank = 0;
    formatted.push(trimmedRight);
  }

  // Ensure single trailing newline
  while (formatted.length > 0 && formatted[formatted.length - 1] === '') {
    formatted.pop();
  }
  return formatted.join('\n') + '\n';
}

/**
 * Static analyzer / linter for Python and PyID code.
 * Checks syntax delimiters, mixed tabs/spaces, bare excepts, missing colons on blocks,
 * unused imports, and line lengths.
 */
export function lintPythonOrPyId(
  source: string,
  filePath: string,
  language: LanguageMode
): DiagnosticItem[] {
  if (language === 'json') {
    try {
      JSON.parse(source);
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      return [
        {
          file: filePath,
          line: 1,
          column: 1,
          severity: 'error',
          message: `JSON Parse Error: ${msg}`,
          source: 'condo-json',
        },
      ];
    }
  }

  if (language !== 'python' && language !== 'pyid') {
    return [];
  }

  const diagnostics: DiagnosticItem[] = [];
  const pythonSrc = language === 'pyid' ? transpilePyIdToPython(source).code : source;
  const origLines = source.replace(/\r\n/g, '\n').split('\n');
  const pyLines = pythonSrc.replace(/\r\n/g, '\n').split('\n');

  const bracketStack: Array<{ char: string; line: number; col: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  const importedSymbols: Array<{ name: string; line: number }> = [];

  for (let idx = 0; idx < pyLines.length; idx++) {
    const lineNum = idx + 1;
    const origLine = origLines[idx] ?? '';
    const pyLine = pyLines[idx] ?? '';

    // Mixed tabs and spaces
    if (/^ +\t|^\t+ /.test(origLine)) {
      diagnostics.push({
        file: filePath,
        line: lineNum,
        column: 1,
        severity: 'warning',
        message: 'Mixed tabs and spaces in indentation',
        source: 'condo-lint',
      });
    }

    // Line length > 100
    if (origLine.length > 100) {
      diagnostics.push({
        file: filePath,
        line: lineNum,
        column: 101,
        severity: 'info',
        message: `Line exceeds 100 characters (${origLine.length})`,
        source: 'condo-style',
      });
    }

    // Strip comment & simple strings for structural check
    const stripped = pyLine.replace(/#.*$/, '').trim();
    if (!stripped) continue;

    // Missing colon on compound statement
    if (
      /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(stripped) &&
      !stripped.endsWith(':') &&
      !stripped.endsWith('\\') &&
      !stripped.includes('(') // avoid multi-line signature false positives
    ) {
      diagnostics.push({
        file: filePath,
        line: lineNum,
        column: origLine.length + 1,
        severity: 'error',
        message: `Expected ':' at end of block header`,
        source: 'condo-lint',
      });
    }

    // Bare except
    if (/^except\s*:$/.test(stripped)) {
      diagnostics.push({
        file: filePath,
        line: lineNum,
        column: 1,
        severity: 'warning',
        message:
          language === 'pyid'
            ? 'Gunakan "kecuali Exception:" alih-alih "kecuali:" kosong'
            : 'Do not use bare "except:"; catch a specific Exception',
        source: 'condo-lint',
      });
    }

    // Track simple imports
    const impMatch = /^import\s+([a-zA-Z_]\w*)(?:\s+as\s+([a-zA-Z_]\w*))?$/.exec(stripped);
    if (impMatch) {
      importedSymbols.push({ name: impMatch[2] || impMatch[1], line: lineNum });
    }
    const fromMatch = /^from\s+[a-zA-Z_][\w.]*\s+import\s+([a-zA-Z_]\w*)(?:\s+as\s+([a-zA-Z_]\w*))?$/.exec(
      stripped
    );
    if (fromMatch) {
      importedSymbols.push({ name: fromMatch[2] || fromMatch[1], line: lineNum });
    }

    // Delimiter balance scan (skipping string literals on line)
    let inQuote: string | null = null;
    for (let c = 0; c < origLine.length; c++) {
      const ch = origLine[c];
      if (inQuote) {
        if (ch === '\\') {
          c++;
          continue;
        }
        if (ch === inQuote) inQuote = null;
        continue;
      }
      if (ch === '#') break;
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (pairs[ch]) {
        bracketStack.push({ char: ch, line: lineNum, col: c + 1 });
      } else if (closers[ch]) {
        const last = bracketStack.pop();
        if (!last || last.char !== closers[ch]) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: c + 1,
            severity: 'error',
            message: `Unmatched closing '${ch}'`,
            source: 'condo-syntax',
          });
        }
      }
    }
  }

  for (const unclosed of bracketStack) {
    diagnostics.push({
      file: filePath,
      line: unclosed.line,
      column: unclosed.col,
      severity: 'error',
      message: `Unclosed '${unclosed.char}'`,
      source: 'condo-syntax',
    });
  }

  // Check unused imports
  const fullTextWithoutImports = pyLines
    .filter((l) => !/^\s*(import|from)\s+/.test(l))
    .join('\n');
  for (const sym of importedSymbols) {
    const usedRe = new RegExp(`\\b${sym.name}\\b`);
    if (!usedRe.test(fullTextWithoutImports)) {
      diagnostics.push({
        file: filePath,
        line: sym.line,
        column: 1,
        severity: 'warning',
        message: `'${sym.name}' imported but unused`,
        source: 'condo-lint',
      });
    }
  }

  return diagnostics;
}
