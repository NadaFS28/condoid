import type { CondoExtension, CondoSnippet, CondoTheme } from './types';

export const BUILTIN_THEMES: CondoTheme[] = [
  {
    id: 'condo-navy-teal',
    name: 'CONDO Navy Teal (Default)',
    author: 'CONDO Core',
    type: 'dark',
    colors: {
      bg: '#080d1a',
      sidebarBg: '#0b1222',
      editorBg: '#0d1526',
      panelBg: '#090f1d',
      accent: '#14b8a6',
      text: '#e2e8f0',
      mutedText: '#94a3b8',
      border: '#1e293b',
      keyword: '#2dd4bf',
      string: '#fbbf24',
      comment: '#64748b',
      number: '#38bdf8',
      function: '#60a5fa',
    },
  },
  {
    id: 'condo-abyss-cyan',
    name: 'Abyss Obsidian Cyan',
    author: 'CONDO Core',
    type: 'dark',
    colors: {
      bg: '#05080f',
      sidebarBg: '#090e1a',
      editorBg: '#0b101d',
      panelBg: '#070b14',
      accent: '#06b6d4',
      text: '#f1f5f9',
      mutedText: '#94a3b8',
      border: '#172033',
      keyword: '#22d3ee',
      string: '#a7f3d0',
      comment: '#64748b',
      number: '#818cf8',
      function: '#38bdf8',
    },
  },
  {
    id: 'condo-daylight',
    name: 'CONDO Daylight Crisp',
    author: 'CONDO Core',
    type: 'light',
    colors: {
      bg: '#f8fafc',
      sidebarBg: '#f1f5f9',
      editorBg: '#ffffff',
      panelBg: '#f8fafc',
      accent: '#0d9488',
      text: '#0f172a',
      mutedText: '#475569',
      border: '#cbd5e1',
      keyword: '#0f766e',
      string: '#b45309',
      comment: '#64748b',
      number: '#0284c7',
      function: '#1d4ed8',
    },
  },
];

export const BUILTIN_SNIPPETS: CondoSnippet[] = [
  {
    id: 'pyid-fungsi',
    prefix: 'fungsi',
    label: 'fungsi (PyID Function)',
    language: 'pyid',
    body: 'fungsi ${1:nama_fungsi}(${2:parameter}):\n    """${3:Dokumentasi fungsi}"""\n    ${4:kembalikan Kosong}',
    description: 'Membuat definisi fungsi baru dalam Python Indonesia (PyID)',
  },
  {
    id: 'pyid-jika',
    prefix: 'jika',
    label: 'jika / lainnya (PyID Conditional)',
    language: 'pyid',
    body: 'jika ${1:kondisi}:\n    ${2:tampilkan("Benar")}\nlainnya:\n    ${3:tampilkan("Salah")}',
    description: 'Blok percabangan jika / lainnya dalam PyID',
  },
  {
    id: 'pyid-kelas',
    prefix: 'kelas',
    label: 'kelas (PyID Class)',
    language: 'pyid',
    body: 'kelas ${1:NamaKelas}:\n    fungsi __init__(self, ${2:nilai}):\n        self.${2:nilai} = ${2:nilai}\n\n    fungsi info(self):\n        kembalikan f"${1:NamaKelas}: {self.${2:nilai}}"',
    description: 'Membuat definisi kelas berorientasi objek dalam PyID',
  },
  {
    id: 'pyid-coba',
    prefix: 'coba',
    label: 'coba / kecuali (PyID Try-Except)',
    language: 'pyid',
    body: 'coba:\n    ${1:lewati}\nkecuali Exception sebagai galat:\n    tampilkan(f"Terjadi kesalahan: {galat}")',
    description: 'Penanganan error aman menggunakan coba / kecuali',
  },
  {
    id: 'py-main',
    prefix: 'ifmain',
    label: 'if __name__ == "__main__"',
    language: 'python',
    body: 'def main():\n    print("Hello from CONDO IDE")\n\nif __name__ == "__main__":\n    main()',
    description: 'Standard Python entry point guard',
  },
];

export const BUILTIN_EXTENSIONS: CondoExtension[] = [
  {
    id: 'condo.pyid-intellisense',
    name: 'PyID Language Pack & IntelliSense',
    version: '1.4.0',
    author: 'CONDO Community',
    description:
      'Syntax highlighting, keyword autocomplete, hover docs, and bidirectional transpiler helpers for Python Indonesia (.cdo).',
    category: 'Language',
    permissions: ['editor:read', 'snippets:register'],
    installed: true,
    enabled: true,
    settings: {
      strictMode: false,
      showHoverTranslations: true,
    },
  },
  {
    id: 'condo.python-lint-pro',
    name: 'Python & PyID Static Linter',
    version: '1.2.1',
    author: 'CONDO Core',
    description:
      'Real-time static analysis for mixed indentation, unused imports, bare except blocks, and delimiter matching.',
    category: 'Tools',
    permissions: ['editor:read', 'workspace:read'],
    installed: true,
    enabled: true,
    settings: {
      maxLineLength: 100,
      warnUnusedImports: true,
    },
  },
  {
    id: 'condo.algoritma-snippets',
    name: 'Algoritma & Struktur Data PyID',
    version: '1.0.3',
    author: 'Nusantara Dev',
    description:
      'Ready-to-use PyID snippets for Binary Search, QuickSort, Queue, and Graph traversal.',
    category: 'Snippets',
    permissions: ['snippets:register', 'commands:register'],
    installed: false,
    enabled: false,
    settings: {
      autoImportTyping: false,
    },
    snippets: [
      {
        id: 'algo-bsearch',
        prefix: 'cari_biner',
        label: 'Binary Search (PyID)',
        language: 'pyid',
        description: 'Implementasi Binary Search dalam PyID',
        body: 'fungsi cari_biner(data, target):\n    kiri, kanan = 0, len(data) - 1\n    selama kiri <= kanan:\n        tengah = (kiri + kanan) // 2\n        jika data[tengah] == target:\n            kembalikan tengah\n        lain_jika data[tengah] < target:\n            kiri = tengah + 1\n        lainnya:\n            kanan = tengah - 1\n    kembalikan -1',
      },
    ],
    commands: [
      {
        id: 'algo.insertBinarySearch',
        title: 'Insert PyID Binary Search Template',
        insertText:
          'fungsi cari_biner(data, target):\n    kiri, kanan = 0, len(data) - 1\n    selama kiri <= kanan:\n        tengah = (kiri + kanan) // 2\n        jika data[tengah] == target:\n            kembalikan tengah\n        lain_jika data[tengah] < target:\n            kiri = tengah + 1\n        lainnya:\n            kanan = tengah - 1\n    kembalikan -1\n',
      },
    ],
  },
  {
    id: 'condo.abyss-cyan-theme',
    name: 'Abyss Obsidian Cyan Theme',
    version: '1.1.0',
    author: 'CONDO Design Lab',
    description: 'Deep obsidian contrast theme tuned for long Python & PyID coding sessions.',
    category: 'Theme',
    permissions: ['theme:register'],
    installed: true,
    enabled: true,
    settings: {},
    theme: BUILTIN_THEMES[1],
  },
  {
    id: 'condo.docgen-pyid',
    name: 'Docstring Generator (PyID/EN)',
    version: '0.9.5',
    author: 'CONDO Community',
    description: 'Generates clean structured docstrings at cursor position.',
    category: 'Productivity',
    permissions: ['editor:read', 'editor:write', 'commands:register'],
    installed: false,
    enabled: false,
    settings: {
      language: 'id',
    },
    commands: [
      {
        id: 'docgen.insertHeader',
        title: 'Insert Module Header Docstring',
        insertText:
          '"""\nModul: main.cdo\nDeskripsi: Ditulis menggunakan CONDO IDE.\n"""\n\n',
      },
    ],
  },
];

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  mode: 'pyid' | 'python';
  files: Record<string, string>;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'pyid-starter',
    name: 'PyID Starter Project (.cdo)',
    description: 'Starter workspace with Python Indonesia (.cdo), pure Python module, config, and Markdown docs.',
    mode: 'pyid',
    files: {
      'condo.cdoproj': JSON.stringify(
        {
          name: 'CONDO PyID Starter',
          version: '1.0.0',
          entryPoint: 'main.cdo',
          mode: 'pyid',
          interpreter: 'python3',
          env: { APP_ENV: 'development', CONDO_MODE: 'pyid' },
          tasks: [
            { name: 'Run Main (.cdo)', command: 'run:main.cdo' },
            { name: 'Run Pure Python', command: 'run:hello.py' },
          ],
        },
        null,
        2
      ),
      'main.cdo': `# CONDO IDE — Python Indonesia (PyID)
impor math
dari datetime impor datetime

fungsi hitung_luas_lingkaran(jari_jari):
    jika jari_jari <= 0:
        kembalikan 0
    kembalikan round(math.pi * (jari_jari ** 2), 2)

fungsi evaluasi_nilai(daftar_nilai):
    hasil = []
    untuk nama, nilai dalam daftar_nilai.items():
        jika nilai >= 85:
            predikat = "A (Sangat Baik)"
        lain_jika nilai >= 75:
            predikat = "B (Lulus)"
        lainnya:
            predikat = "C (Perlu Remedial)"
        hasil.append((nama, nilai, predikat))
    kembalikan hasil

tampilkan("=== CONDO IDE PyID Runtime ===")
tampilkan("Waktu:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
tampilkan("Luas lingkaran r=7:", hitung_luas_lingkaran(7))

data_siswa = {"Budi": 90, "Siti": 78, "Andi": 64}
untuk nama, nilai, status dalam evaluasi_nilai(data_siswa):
    tampilkan(f"- {nama}: {nilai} -> {status}")
`,
      'kalkulator.cdo': `# Modul Kalkulator PyID
kelas Kalkulator:
    fungsi __init__(self, awal=0):
        self.nilai = awal

    fungsi tambah(self, angka):
        self.nilai += angka
        kembalikan self.nilai

    fungsi kurang(self, angka):
        self.nilai -= angka
        kembalikan self.nilai

jika __name__ == "__main__":
    k = Kalkulator(10)
    tampilkan("10 + 5 =", k.tambah(5))
    tampilkan("15 - 3 =", k.kurang(3))
`,
      'hello.py': `import sys
import platform

def greet(target: str = "Developer") -> str:
    return f"Hello, {target}! Running CPython {platform.python_version()}"

if __name__ == "__main__":
    print(greet("CONDO IDE"))
    print("Executable:", sys.executable)
`,
      'requirements.txt': `# Python project dependencies\n# Add packages here, e.g.:\n# requests>=2.31.0\n`,
      'config.json': JSON.stringify(
        {
          appName: 'CONDO PyID Starter',
          debug: true,
          maxRetries: 3,
          features: ['pyid-transpiler', 'cpython-runtime', 'debugger'],
        },
        null,
        2
      ),
      'README.md': `# CONDO PyID Starter\n\nWrite. Run. Build. Create.\n\n## File Formats\n- \`main.cdo\` — Python Indonesia (PyID) source file\n- \`condo.cdoproj\` — CONDO project configuration\n- \`hello.py\` — Standard Python 3 script\n\n## Try Running\nOpen \`main.cdo\` and click **Run** in the top bar, or open the integrated terminal and run \`python3 hello.py\`.\n`,
      '.gitignore': `__pycache__/\n*.py[cod]\n.venv/\n.condo-tmp/\n`,
    },
  },
  {
    id: 'python-cli',
    name: 'Python CLI Application (.py)',
    description: 'Clean modular Python 3 CLI project with structured tests and requirements.',
    mode: 'python',
    files: {
      'condo.cdoproj': JSON.stringify(
        {
          name: 'Python CLI App',
          version: '1.0.0',
          entryPoint: 'app.py',
          mode: 'python',
          interpreter: 'python3',
          env: { PYTHONUTF8: '1' },
          tasks: [{ name: 'Run CLI', command: 'run:app.py' }],
        },
        null,
        2
      ),
      'app.py': `import json
from dataclasses import dataclass, asdict

@dataclass
class Task:
    id: int
    title: str
    done: bool = False

def main():
    tasks = [
        Task(1, "Configure workspace"),
        Task(2, "Write Python module", done=True),
    ]
    print(json.dumps([asdict(t) for t in tasks], indent=2))

if __name__ == "__main__":
    main()
`,
      'requirements.txt': '',
      '.gitignore': `__pycache__/\n.venv/\n`,
    },
  },
  {
    id: 'pyid-oop-bank',
    name: 'OOP Simulasi Bank (PyID)',
    description: 'Object-oriented banking simulation written completely in Python Indonesia (.cdo).',
    mode: 'pyid',
    files: {
      'condo.cdoproj': JSON.stringify(
        {
          name: 'Simulasi Bank PyID',
          version: '1.0.0',
          entryPoint: 'bank.cdo',
          mode: 'pyid',
          interpreter: 'python3',
          env: {},
          tasks: [{ name: 'Jalankan Simulasi', command: 'run:bank.cdo' }],
        },
        null,
        2
      ),
      'bank.cdo': `kelas Rekening:
    fungsi __init__(self, pemilik, saldo=0):
        self.pemilik = pemilik
        self.saldo = saldo

    fungsi setor(self, jumlah):
        jika jumlah <= 0:
            angkat ValueError("Jumlah setor harus positif")
        self.saldo += jumlah
        kembalikan self.saldo

    fungsi tarik(self, jumlah):
        jika jumlah > self.saldo:
            tampilkan("Saldo tidak mencukupi!")
            kembalikan Salah
        self.saldo -= jumlah
        kembalikan Benar

rek = Rekening("Alya", 500000)
tampilkan("Saldo awal:", rek.saldo)
rek.setor(250000)
tampilkan("Setelah setor:", rek.saldo)
jika rek.tarik(100000):
    tampilkan("Penarikan berhasil. Sisa saldo:", rek.saldo)
`,
      '.gitignore': `__pycache__/\n.venv/\n`,
    },
  },
];
