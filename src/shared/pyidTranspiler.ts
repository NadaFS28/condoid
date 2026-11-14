/**
 * Bidirectional Python Indonesia (PyID) <-> Python Transpiler
 *
 * Uses a Python-aware lexical scanner so that string literals (including
 * triple-quoted strings, raw/f-strings, and escapes), comments, and user
 * identifiers containing keyword substrings are NEVER corrupted.
 */

export const PYID_TO_PYTHON_KEYWORDS: Record<string, string> = {
  jika: 'if',
  lain_jika: 'elif',
  lainnya: 'else',
  selama: 'while',
  untuk: 'for',
  fungsi: 'def',
  kembalikan: 'return',
  tampilkan: 'print',
  masukan: 'input',
  Benar: 'True',
  Salah: 'False',
  Kosong: 'None',
  impor: 'import',
  dari: 'from',
  sebagai: 'as',
  kelas: 'class',
  coba: 'try',
  kecuali: 'except',
  akhirnya: 'finally',
  dengan: 'with',
  dan: 'and',
  atau: 'or',
  bukan: 'not',
  dalam: 'in',
  adalah: 'is',
  lewati: 'pass',
  berhenti: 'break',
  lanjut: 'continue',
  angkat: 'raise',
  hasilkan: 'yield',
  global: 'global',
  nonlokal: 'nonlocal',
  tegaskan: 'assert',
  hapus: 'del',
};

export const PYTHON_TO_PYID_KEYWORDS: Record<string, string> = Object.entries(
  PYID_TO_PYTHON_KEYWORDS
).reduce((acc, [pyid, py]) => {
  acc[py] = pyid;
  return acc;
}, {} as Record<string, string>);

export interface TranspileResult {
  code: string;
  /** Maps 1-based transpiled line number -> 1-based original line number */
  lineMap: Record<number, number>;
  /** Number of PyID tokens translated */
  replacements: number;
}

const STRING_PREFIX_CHARS = new Set(['r', 'R', 'u', 'U', 'b', 'B', 'f', 'F']);

function isIdentStart(ch: string): boolean {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    ch === '_' ||
    ch.charCodeAt(0) > 127
  );
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

function isStringPrefix(src: string, idx: number): number {
  const c0 = src[idx];
  const c1 = src[idx + 1];
  const c2 = src[idx + 2];
  if (c0 && STRING_PREFIX_CHARS.has(c0)) {
    if (c1 === '"' || c1 === "'") {
      return 1;
    }
    if (c1 && STRING_PREFIX_CHARS.has(c1) && (c2 === '"' || c2 === "'")) {
      return 2;
    }
  }
  return 0;
}

/**
 * Transforms PyID code to Python or Python code to PyID while preserving
 * exact line counts, string literals, comments, and member attribute names (after '.').
 */
function transformCode(
  source: string,
  dictionary: Record<string, string>
): TranspileResult {
  const out: string[] = [];
  const lineMap: Record<number, number> = {};
  let currentLine = 1;
  lineMap[1] = 1;

  let i = 0;
  const len = source.length;
  let replacements = 0;
  let lastNonWsToken = '';

  const pushText = (text: string) => {
    out.push(text);
    for (let k = 0; k < text.length; k++) {
      if (text[k] === '\n') {
        currentLine++;
        lineMap[currentLine] = currentLine;
      }
    }
  };

  while (i < len) {
    const ch = source[i];

    // 1. Line comment
    if (ch === '#') {
      const start = i;
      while (i < len && source[i] !== '\n') {
        i++;
      }
      pushText(source.slice(start, i));
      continue;
    }

    // 2. String literal (with optional prefix r/f/b/u)
    const prefixLen = isStringPrefix(source, i);
    const quoteIdx = i + prefixLen;
    const quoteChar = source[quoteIdx];
    if ((prefixLen > 0 || ch === '"' || ch === "'") && (quoteChar === '"' || quoteChar === "'")) {
      const isTriple =
        source[quoteIdx + 1] === quoteChar && source[quoteIdx + 2] === quoteChar;
      const start = i;
      const prefixStr = source.slice(i, quoteIdx).toLowerCase();
      const isFString = prefixStr.includes('f');
      const isRaw = prefixStr.includes('r');
      i = quoteIdx + (isTriple ? 3 : 1);

      while (i < len) {
        if (!isRaw && source[i] === '\\') {
          i += 2;
          continue;
        }
        if (isTriple) {
          if (
            source[i] === quoteChar &&
            source[i + 1] === quoteChar &&
            source[i + 2] === quoteChar
          ) {
            i += 3;
            break;
          }
        } else {
          if (source[i] === quoteChar || source[i] === '\n') {
            if (source[i] === quoteChar) i++;
            break;
          }
        }
        i++;
      }

      const rawLiteral = source.slice(start, i);
      if (isFString) {
        // Transform expressions inside { ... } within f-strings carefully
        const transformedF = transformFString(rawLiteral, dictionary);
        replacements += transformedF.replacements;
        pushText(transformedF.text);
      } else {
        pushText(rawLiteral);
      }
      lastNonWsToken = 'STRING';
      continue;
    }

    // 3. Identifier / keyword
    if (isIdentStart(ch)) {
      const start = i;
      i++;
      while (i < len && isIdentPart(source[i])) {
        i++;
      }
      const word = source.slice(start, i);
      // Do not translate attribute names after '.' (e.g. obj.input or obj.tampilkan)
      const mapped = lastNonWsToken === '.' ? undefined : dictionary[word];
      if (mapped !== undefined) {
        pushText(mapped);
        replacements++;
      } else {
        pushText(word);
      }
      lastNonWsToken = word;
      continue;
    }

    // 4. Whitespace or punctuation
    if (ch !== ' ' && ch !== '\t' && ch !== '\r' && ch !== '\n') {
      lastNonWsToken = ch;
    }
    pushText(ch);
    i++;
  }

  return {
    code: out.join(''),
    lineMap,
    replacements,
  };
}

function transformFString(
  literal: string,
  dictionary: Record<string, string>
): { text: string; replacements: number } {
  // Find quote start
  let qIdx = 0;
  while (qIdx < literal.length && literal[qIdx] !== '"' && literal[qIdx] !== "'") {
    qIdx++;
  }
  const qChar = literal[qIdx];
  const isTriple = literal[qIdx + 1] === qChar && literal[qIdx + 2] === qChar;
  const openLen = qIdx + (isTriple ? 3 : 1);
  const closeLen = isTriple ? 3 : 1;
  if (literal.length < openLen + closeLen) {
    return { text: literal, replacements: 0 };
  }

  const header = literal.slice(0, openLen);
  const footer = literal.slice(literal.length - closeLen);
  const body = literal.slice(openLen, literal.length - closeLen);

  let result = header;
  let totalReplacements = 0;
  let i = 0;
  while (i < body.length) {
    if (body[i] === '{') {
      if (body[i + 1] === '{') {
        result += '{{';
        i += 2;
        continue;
      }
      // Scan balanced expression up to ':' or '!' or '}'
      let depth = 1;
      let j = i + 1;
      let inStr: string | null = null;
      let formatSpecStart = -1;
      while (j < body.length && depth > 0) {
        const c = body[j];
        if (inStr) {
          if (c === '\\') {
            j += 2;
            continue;
          }
          if (c === inStr) inStr = null;
        } else {
          if (c === '"' || c === "'") {
            inStr = c;
          } else if (c === '{') {
            depth++;
          } else if (c === '}') {
            depth--;
            if (depth === 0) break;
          } else if (depth === 1 && (c === ':' || c === '!') && formatSpecStart === -1) {
            formatSpecStart = j;
          }
        }
        j++;
      }
      const exprEnd = formatSpecStart !== -1 ? formatSpecStart : j;
      const expr = body.slice(i + 1, exprEnd);
      const transExpr = transformCode(expr, dictionary);
      totalReplacements += transExpr.replacements;
      const suffix = formatSpecStart !== -1 ? body.slice(formatSpecStart, j) : '';
      result += '{' + transExpr.code + suffix + (j < body.length ? '}' : '');
      i = j + 1;
    } else if (body[i] === '}' && body[i + 1] === '}') {
      result += '}}';
      i += 2;
    } else {
      result += body[i];
      i++;
    }
  }

  return { text: result + footer, replacements: totalReplacements };
}

export function transpilePyIdToPython(source: string): TranspileResult {
  return transformCode(source, PYID_TO_PYTHON_KEYWORDS);
}

export function transpilePythonToPyId(source: string): TranspileResult {
  return transformCode(source, PYTHON_TO_PYID_KEYWORDS);
}

/**
 * Remaps Python traceback line references from the temporary transpiled script
 * back to the user's original .cdo file name and original line number.
 */
export function remapTracebackToOriginal(
  stderr: string,
  tempFilePath: string,
  originalFilePath: string,
  lineMap: Record<number, number>
): string {
  const escapedTemp = tempFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`File "(?:${escapedTemp}|[^"]*${escapedTemp.split('/').pop()})", line (\\d+)`, 'g');
  return stderr.replace(pattern, (_match, lineStr) => {
    const lineNum = Number(lineStr);
    const mappedLine = lineMap[lineNum] ?? lineNum;
    return `File "${originalFilePath}", line ${mappedLine}`;
  });
}

export function detectIsPyId(code: string, filename?: string): boolean {
  if (filename?.endsWith('.cdo')) return true;
  if (filename?.endsWith('.py')) return false;
  return /\b(jika|lainnya|fungsi|tampilkan|selama|untuk|kembalikan|kelas|impor)\b/.test(code);
}
