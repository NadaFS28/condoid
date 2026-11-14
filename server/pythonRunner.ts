import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  detectIsPyId,
  remapTracebackToOriginal,
  transpilePyIdToPython,
} from '../src/shared/pyidTranspiler';
import type { DiagnosticItem } from '../src/shared/types';
import { workspaceManager } from './workspaceManager';

const execFileAsync = promisify(execFile);

export async function resolvePythonExecutable(workspaceId: string): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const venvPy = path.join(wsDir, '.venv', 'bin', 'python3');
  try {
    await fs.access(venvPy);
    return venvPy;
  } catch {
    return 'python3';
  }
}

export async function getPythonEnvironmentInfo(workspaceId: string) {
  const executable = await resolvePythonExecutable(workspaceId);
  const { stdout: verOut } = await execFileAsync(executable, ['--version']);
  const { stdout: sysInfo } = await execFileAsync(executable, [
    '-c',
    'import sys, importlib.metadata, json; pkgs = sorted([{"name": d.metadata["Name"], "version": d.version} for d in importlib.metadata.distributions()], key=lambda x: x["name"].lower()); print(json.dumps({"executable": sys.executable, "version": sys.version.split()[0], "packages": pkgs}))',
  ]);
  const info = JSON.parse(sysInfo);

  // Check if pip is installed
  let pipAvailable = false;
  try {
    await execFileAsync(executable, ['-m', 'pip', '--version']);
    pipAvailable = true;
  } catch {
    pipAvailable = false;
  }

  let hasVenv = false;
  try {
    await fs.access(path.join(workspaceManager.getWorkspaceDir(workspaceId), '.venv'));
    hasVenv = true;
  } catch {
    hasVenv = false;
  }

  return {
    versionLabel: verOut.trim(),
    executable: info.executable as string,
    version: info.version as string,
    packages: info.packages as Array<{ name: string; version: string }>,
    pipAvailable,
    hasVenv,
  };
}

export async function createVirtualEnv(workspaceId: string): Promise<{ ok: boolean; output: string }> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  try {
    const { stdout, stderr } = await execFileAsync('python3', ['-m', 'venv', '.venv'], {
      cwd: wsDir,
      timeout: 30000,
    });
    return { ok: true, output: (stdout + stderr).trim() || 'Virtual environment created at .venv' };
  } catch (err: any) {
    return {
      ok: false,
      output: err?.stderr || err?.message || 'Failed to create virtual environment',
    };
  }
}

export async function runPipCommand(
  workspaceId: string,
  args: string[]
): Promise<{ ok: boolean; output: string }> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const pythonExec = await resolvePythonExecutable(workspaceId);
  try {
    const { stdout, stderr } = await execFileAsync(pythonExec, ['-m', 'pip', ...args], {
      cwd: wsDir,
      timeout: 60000,
    });
    return { ok: true, output: (stdout + '\n' + stderr).trim() };
  } catch (err: any) {
    const msg = [err?.stdout, err?.stderr, err?.message].filter(Boolean).join('\n').trim();
    return { ok: false, output: msg || 'pip execution failed' };
  }
}

/**
 * Runs real CPython AST syntax verification on Python or transpiled PyID code.
 */
export async function checkPythonSyntax(
  workspaceId: string,
  filePath: string,
  content: string,
  forceMode?: 'pyid' | 'python'
): Promise<DiagnosticItem[]> {
  const isPyId = forceMode ? forceMode === 'pyid' : detectIsPyId(content, filePath);
  const transpiled = isPyId
    ? transpilePyIdToPython(content)
    : { code: content, lineMap: {} as Record<number, number>, replacements: 0 };

  const pythonExec = await resolvePythonExecutable(workspaceId);
  const script = `
import ast, json, sys
src = sys.stdin.read()
try:
    ast.parse(src)
    print("[]")
except SyntaxError as e:
    print(json.dumps([{
        "line": e.lineno or 1,
        "column": e.offset or 1,
        "message": e.msg or "SyntaxError"
    }]))
`;

  return new Promise((resolve) => {
    const proc = spawn(pythonExec, ['-c', script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(out.trim() || '[]') as Array<{
          line: number;
          column: number;
          message: string;
        }>;
        resolve(
          parsed.map((item) => ({
            file: filePath,
            line: transpiled.lineMap[item.line] ?? item.line,
            column: item.column,
            severity: 'error',
            message: item.message,
            source: 'cpython-ast',
          }))
        );
      } catch {
        resolve([]);
      }
    });
    proc.stdin.write(transpiled.code);
    proc.stdin.end();
  });
}

export interface PreparedPythonExecution {
  pythonExec: string;
  targetFile: string;
  cleanup: () => Promise<void>;
  lineMap: Record<number, number>;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export async function preparePythonFile(
  workspaceId: string,
  relPath: string,
  overrideContent?: string,
  mode?: 'pyid' | 'python'
): Promise<PreparedPythonExecution> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const origFull = workspaceManager.resolveSafePath(workspaceId, relPath);
  const source =
    overrideContent !== undefined
      ? overrideContent
      : await fs.readFile(origFull, 'utf-8');

  const isPyId = mode ? mode === 'pyid' : detectIsPyId(source, relPath);
  const pythonExec = await resolvePythonExecutable(workspaceId);
  const projConfig = await workspaceManager.getProjectConfig(workspaceId);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    ...(projConfig?.env || {}),
  };

  if (!isPyId) {
    return {
      pythonExec,
      targetFile: origFull,
      cleanup: async () => {},
      lineMap: {},
      cwd: path.dirname(origFull),
      env,
    };
  }

  const transpiled = transpilePyIdToPython(source);
  const tmpDir = path.join(wsDir, '.condo-tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(
    tmpDir,
    `${path.basename(relPath, path.extname(relPath))}_${Date.now()}.py`
  );
  await fs.writeFile(tmpFile, transpiled.code, 'utf-8');

  return {
    pythonExec,
    targetFile: tmpFile,
    cleanup: async () => {
      await fs.rm(tmpFile, { force: true }).catch(() => {});
    },
    lineMap: transpiled.lineMap,
    cwd: path.dirname(origFull),
    env,
  };
}

export function spawnDebuggerProcess(
  prep: PreparedPythonExecution,
  displayFile: string,
  breakpoints: number[],
  watches: string[],
  stopOnEntry: boolean
): ChildProcess {
  const debuggerScript = path.resolve(process.cwd(), 'server', 'condo_debugger.py');
  const configArg = JSON.stringify({
    targetFile: prep.targetFile,
    displayFile,
    lineMap: prep.lineMap,
    breakpoints,
    watches,
    stopOnEntry,
  });

  // FD 0,1,2: user stdin/stdout/stderr; FD 3: debug commands in; FD 4: debug events out
  return spawn(prep.pythonExec, ['-u', debuggerScript, configArg], {
    cwd: prep.cwd,
    env: prep.env,
    stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
  });
}

export { remapTracebackToOriginal };
