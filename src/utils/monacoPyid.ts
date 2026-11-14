import type * as Monaco from 'monaco-editor';
import {
  PYID_TO_PYTHON_KEYWORDS,
  PYTHON_TO_PYID_KEYWORDS,
} from '../shared/pyidTranspiler';
import type { CondoSnippet, CondoTheme } from '../shared/types';

let registered = false;
let dynamicSnippets: CondoSnippet[] = [];

export function updateMonacoSnippets(snippets: CondoSnippet[]) {
  dynamicSnippets = snippets;
}

export function registerCondoMonacoLanguages(monaco: typeof Monaco) {
  if (registered) return;
  registered = true;

  // Register PyID language
  monaco.languages.register({
    id: 'pyid',
    extensions: ['.cdo'],
    aliases: ['PyID (Python Indonesia)', 'pyid'],
  });

  const pyidKeywords = Object.keys(PYID_TO_PYTHON_KEYWORDS);
  const pyKeywords = Object.keys(PYTHON_TO_PYID_KEYWORDS);
  const builtins = [
    'tampilkan',
    'masukan',
    'len',
    'range',
    'int',
    'str',
    'float',
    'list',
    'dict',
    'set',
    'tuple',
    'bool',
    'enumerate',
    'zip',
    'sum',
    'min',
    'max',
    'sorted',
    'round',
    'abs',
    'open',
    'type',
    'isinstance',
    'print',
    'input',
  ];

  monaco.languages.setLanguageConfiguration('pyid', {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern: /^\s*(jika|lain_jika|lainnya|selama|untuk|fungsi|kelas|coba|kecuali|akhirnya|dengan|if|elif|else|while|for|def|class|try|except|finally|with)\b.*:\s*(#.*)?$/,
      decreaseIndentPattern: /^\s*(kembalikan|lewati|berhenti|lanjut|angkat|return|pass|break|continue|raise)\b.*$/,
    },
    folding: {
      offSide: true,
    },
  });

  monaco.languages.setMonarchTokensProvider('pyid', {
    defaultToken: '',
    tokenPostfix: '.pyid',
    keywords: [...pyidKeywords, ...pyKeywords],
    builtins,
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.bracket' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
    ],
    tokenizer: {
      root: [
        { include: '@whitespace' },
        { include: '@numbers' },
        { include: '@strings' },
        [/[,:;]/, 'delimiter'],
        [/[{}[\]()]/, '@brackets'],
        [/@[a-zA-Z_]\w*/, 'tag'],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@builtins': 'type.identifier',
              '@default': 'identifier',
            },
          },
        ],
      ],
      whitespace: [
        [/\s+/, 'white'],
        [/(#.*$)/, 'comment'],
      ],
      numbers: [
        [/-?0x([abcdef]|[ABCDEF]|\d)+[lL]?/, 'number.hex'],
        [/-?(\d*\.)?\d+([eE][+-]?\d+)?[jJ]?/, 'number'],
      ],
      strings: [
        [/'$/, 'string.escape', '@popall'],
        [/'/, 'string.escape', '@stringBody'],
        [/"$/, 'string.escape', '@popall'],
        [/"/, 'string.escape', '@dblStringBody'],
      ],
      stringBody: [
        [/[^\\']+$/, 'string', '@popall'],
        [/[^\\']+/, 'string'],
        [/\\./, 'string'],
        [/'/, 'string.escape', '@popall'],
        [/\\$/, 'string'],
      ],
      dblStringBody: [
        [/[^\\"]+$/, 'string', '@popall'],
        [/[^\\"]+/, 'string'],
        [/\\./, 'string'],
        [/"/, 'string.escape', '@popall'],
        [/\\$/, 'string'],
      ],
    },
  });

  // Autocomplete provider for PyID & Python
  const registerCompletions = (langId: 'pyid' | 'python') => {
    monaco.languages.registerCompletionItemProvider(langId, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const items: Monaco.languages.CompletionItem[] = [];

        if (langId === 'pyid') {
          for (const [pyidKw, pyKw] of Object.entries(PYID_TO_PYTHON_KEYWORDS)) {
            items.push({
              label: pyidKw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: pyidKw,
              detail: `PyID → Python '${pyKw}'`,
              range,
            });
          }
        }

        for (const b of builtins) {
          items.push({
            label: b,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${b}($1)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Builtin function',
            range,
          });
        }

        for (const snip of dynamicSnippets) {
          if (snip.language === 'all' || snip.language === langId) {
            items.push({
              label: snip.prefix,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: snip.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: snip.label,
              documentation: snip.description,
              range,
            });
          }
        }

        // Also scan current file identifiers for local symbol autocomplete
        const text = model.getValue();
        const defs = new Set<string>();
        const defRegex = /(?:fungsi|def|kelas|class)\s+([a-zA-Z_]\w*)/g;
        let m: RegExpExecArray | null;
        while ((m = defRegex.exec(text)) !== null) {
          defs.add(m[1]);
        }
        for (const sym of defs) {
          items.push({
            label: sym,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: sym,
            detail: 'Symbol in current file',
            range,
          });
        }

        return { suggestions: items };
      },
    });

    // Hover documentation provider
    monaco.languages.registerHoverProvider(langId, {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        const w = word.word;
        if (PYID_TO_PYTHON_KEYWORDS[w]) {
          return {
            contents: [
              { value: `**PyID Keyword** \`${w}\`` },
              { value: `Transpiles to Python: \`${PYID_TO_PYTHON_KEYWORDS[w]}\`` },
            ],
          };
        }
        if (PYTHON_TO_PYID_KEYWORDS[w]) {
          return {
            contents: [
              { value: `**Python Keyword** \`${w}\`` },
              { value: `PyID equivalent: \`${PYTHON_TO_PYID_KEYWORDS[w]}\`` },
            ],
          };
        }
        return null;
      },
    });

    // Go to Definition within current file
    monaco.languages.registerDefinitionProvider(langId, {
      provideDefinition: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        const lines = model.getLinesContent();
        const targetRe = new RegExp(`^\\s*(?:fungsi|def|kelas|class)\\s+${word.word}\\b`);
        for (let i = 0; i < lines.length; i++) {
          if (targetRe.test(lines[i])) {
            return {
              uri: model.uri,
              range: {
                startLineNumber: i + 1,
                startColumn: 1,
                endLineNumber: i + 1,
                endColumn: lines[i].length + 1,
              },
            };
          }
        }
        return null;
      },
    });
  };

  registerCompletions('pyid');
  registerCompletions('python');
}

export function applyCondoMonacoTheme(monaco: typeof Monaco, theme: CondoTheme) {
  const monacoThemeId = `condo-${theme.id}`;
  monaco.editor.defineTheme(monacoThemeId, {
    base: theme.type === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: theme.colors.keyword.replace('#', ''), fontStyle: 'bold' },
      { token: 'string', foreground: theme.colors.string.replace('#', '') },
      { token: 'comment', foreground: theme.colors.comment.replace('#', ''), fontStyle: 'italic' },
      { token: 'number', foreground: theme.colors.number.replace('#', '') },
      { token: 'type.identifier', foreground: theme.colors.function.replace('#', '') },
    ],
    colors: {
      'editor.background': theme.colors.editorBg,
      'editor.foreground': theme.colors.text,
      'editorLineNumber.foreground': theme.colors.mutedText,
      'editorLineNumber.activeForeground': theme.colors.accent,
      'editor.selectionBackground': `${theme.colors.accent}33`,
      'editor.lineHighlightBackground':
        theme.type === 'dark' ? '#131d33' : '#f1f5f9',
      'editorCursor.foreground': theme.colors.accent,
      'editorIndentGuide.background1': theme.colors.border,
    },
  });
  monaco.editor.setTheme(monacoThemeId);
  return monacoThemeId;
}
