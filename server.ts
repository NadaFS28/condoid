import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  gitBranchCreateOrSwitch,
  gitCloneIntoWorkspace,
  gitCommit,
  gitDiff,
  gitInit,
  gitMerge,
  gitPullOrPush,
  gitStage,
  gitUnstage,
  getGitStatus,
} from './server/gitManager';
import {
  checkPythonSyntax,
  createVirtualEnv,
  getPythonEnvironmentInfo,
  preparePythonFile,
  remapTracebackToOriginal,
  runPipCommand,
  spawnDebuggerProcess,
  type PreparedPythonExecution,
} from './server/pythonRunner';
import aiRoutes from './server/routes/ai';
import { attachTerminalSession } from './server/terminalManager';
import { workspaceManager } from './server/workspaceManager';

dotenv.config();

const PORT = 3000;

async function startServer() {
  await workspaceManager.init();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // --- Workspace & File Management API ---
  app.get('/api/workspaces', async (_req, res) => {
    try {
      const workspaces = await workspaceManager.listWorkspaces();
      res.json({ workspaces });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workspaces', async (req, res) => {
    try {
      const { templateId, name } = req.body;
      const workspace = await workspaceManager.createWorkspaceFromTemplate(
        templateId || 'pyid-starter',
        name
      );
      res.json({ workspace });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/workspaces/:id', async (req, res) => {
    try {
      await workspaceManager.deleteWorkspace(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workspaces/:id/tree', async (req, res) => {
    try {
      await workspaceManager.touchWorkspace(req.params.id);
      const tree = await workspaceManager.getFileTree(req.params.id);
      const config = await workspaceManager.getProjectConfig(req.params.id);
      res.json({ tree, config });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/workspaces/:id/file', async (req, res) => {
    try {
      const relPath = String(req.query.path || '');
      const content = await workspaceManager.readFile(req.params.id, relPath);
      res.json({ path: relPath, content });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.put('/api/workspaces/:id/file', async (req, res) => {
    try {
      const { path: relPath, content } = req.body;
      await workspaceManager.writeFile(req.params.id, relPath, content ?? '');
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/workspaces/:id/folder', async (req, res) => {
    try {
      const { path: relPath } = req.body;
      await workspaceManager.createFolder(req.params.id, relPath);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/workspaces/:id/rename', async (req, res) => {
    try {
      const { oldPath, newPath } = req.body;
      await workspaceManager.renamePath(req.params.id, oldPath, newPath);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/workspaces/:id/copy', async (req, res) => {
    try {
      const { srcPath, dstPath } = req.body;
      await workspaceManager.copyPath(req.params.id, srcPath, dstPath);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/workspaces/:id/path', async (req, res) => {
    try {
      const relPath = String(req.query.path || '');
      await workspaceManager.deletePath(req.params.id, relPath);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/workspaces/:id/import-files', async (req, res) => {
    try {
      const { files } = req.body as {
        files: Array<{ path: string; content: string }>;
      };
      for (const f of files || []) {
        await workspaceManager.writeFile(req.params.id, f.path, f.content);
      }
      res.json({ ok: true, count: files?.length || 0 });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/workspaces/:id/export-files', async (req, res) => {
    try {
      const tree = await workspaceManager.getFileTree(req.params.id);
      const files: Array<{ path: string; content: string }> = [];
      const collect = async (nodes: typeof tree) => {
        for (const n of nodes) {
          if (n.type === 'folder' && n.children) {
            await collect(n.children);
          } else if (n.type === 'file') {
            const content = await workspaceManager.readFile(req.params.id, n.path);
            files.push({ path: n.path, content });
          }
        }
      };
      await collect(tree);
      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workspaces/:id/search', async (req, res) => {
    try {
      const q = String(req.query.q || '');
      const caseSensitive = req.query.case === 'true';
      const regex = req.query.regex === 'true';
      const matches = await workspaceManager.searchInWorkspace(req.params.id, q, {
        caseSensitive,
        regex,
      });
      res.json({ matches });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Python Runtime, Syntax Lint, Packages & Venv API ---
  app.get('/api/python/:id/env', async (req, res) => {
    try {
      const info = await getPythonEnvironmentInfo(req.params.id);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/python/:id/venv', async (req, res) => {
    try {
      const result = await createVirtualEnv(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, output: err.message });
    }
  });

  app.post('/api/python/:id/pip', async (req, res) => {
    try {
      const { action, pkg } = req.body as { action: 'install' | 'install-req' | 'uninstall'; pkg?: string };
      let args: string[] = [];
      if (action === 'install-req') {
        args = ['install', '-r', 'requirements.txt'];
      } else if (action === 'install' && pkg) {
        args = ['install', pkg.trim()];
      } else if (action === 'uninstall' && pkg) {
        args = ['uninstall', '-y', pkg.trim()];
      } else {
        res.status(400).json({ ok: false, output: 'Invalid pip action or package name' });
        return;
      }
      const result = await runPipCommand(req.params.id, args);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, output: err.message });
    }
  });

  app.post('/api/python/:id/lint', async (req, res) => {
    try {
      const { path: relPath, content, mode } = req.body;
      const diagnostics = await checkPythonSyntax(req.params.id, relPath, content, mode);
      res.json({ diagnostics });
    } catch (err: any) {
      res.status(500).json({ diagnostics: [], error: err.message });
    }
  });

  // --- Git API ---
  app.get('/api/git/:id/status', async (req, res) => {
    try {
      const status = await getGitStatus(req.params.id);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/git/:id/init', async (req, res) => {
    try {
      const output = await gitInit(req.params.id);
      res.json({ ok: true, output });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/git/:id/stage', async (req, res) => {
    try {
      await gitStage(req.params.id, req.body.path);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/git/:id/unstage', async (req, res) => {
    try {
      await gitUnstage(req.params.id, req.body.path);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/git/:id/commit', async (req, res) => {
    try {
      const output = await gitCommit(req.params.id, req.body.message);
      res.json({ ok: true, output });
    } catch (err: any) {
      res.status(400).json({ error: err.stderr || err.message });
    }
  });

  app.post('/api/git/:id/branch', async (req, res) => {
    try {
      const output = await gitBranchCreateOrSwitch(
        req.params.id,
        req.body.name,
        Boolean(req.body.create)
      );
      res.json({ ok: true, output });
    } catch (err: any) {
      res.status(400).json({ error: err.stderr || err.message });
    }
  });

  app.post('/api/git/:id/merge', async (req, res) => {
    try {
      const output = await gitMerge(req.params.id, req.body.branch);
      res.json({ ok: true, output });
    } catch (err: any) {
      res.status(400).json({ error: err.stderr || err.message });
    }
  });

  app.get('/api/git/:id/diff', async (req, res) => {
    try {
      const diff = await gitDiff(req.params.id, req.query.path as string | undefined);
      res.json({ diff });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/git/:id/clone', async (req, res) => {
    try {
      const output = await gitCloneIntoWorkspace(req.params.id, req.body.url);
      res.json({ ok: true, output });
    } catch (err: any) {
      res.status(400).json({ error: err.stderr || err.message });
    }
  });

  app.post('/api/git/:id/sync', async (req, res) => {
    try {
      const output = await gitPullOrPush(req.params.id, req.body.action, req.body.remoteUrl);
      res.json({ ok: true, output });
    } catch (err: any) {
      res.status(400).json({ error: err.stderr || err.message });
    }
  });

  // --- Gemini AI Assistant API ---
  app.use('/api/ai', aiRoutes);

  // --- Vite / Static Serving ---
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- WebSocket Server for Real Terminal, Python Execution & Debugger ---
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (url.pathname === '/ws/terminal' || url.pathname === '/ws/runtime') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, url);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, url: URL) => {
    if (url.pathname === '/ws/terminal') {
      const workspaceId = url.searchParams.get('workspaceId') || '';
      const sessionId = url.searchParams.get('sessionId') || `term-${Date.now()}`;
      const mode = url.searchParams.get('mode') === 'python' ? 'python' : 'bash';
      attachTerminalSession(ws, workspaceId, sessionId, mode).catch((err) => {
        ws.send(JSON.stringify({ type: 'data', data: `\r\nTerminal error: ${err.message}\r\n` }));
      });
      return;
    }

    if (url.pathname === '/ws/runtime') {
      handleRuntimeWebSocket(ws);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CONDO IDE server listening on http://localhost:${PORT}`);
  });
}

function handleRuntimeWebSocket(ws: WebSocket) {
  let activeProc: ChildProcess | null = null;
  let activePrep: PreparedPythonExecution | null = null;
  let activeDisplayFile = '';

  const cleanupProc = async () => {
    if (activeProc) {
      activeProc.kill('SIGTERM');
      activeProc = null;
    }
    if (activePrep) {
      await activePrep.cleanup();
      activePrep = null;
    }
  };

  ws.on('message', async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'run') {
      await cleanupProc();
      const { workspaceId, filePath, content, mode } = msg;
      try {
        // Save or run directly with optional override content (for Run Selected Code)
        const prep = await preparePythonFile(workspaceId, filePath, content, mode);
        activePrep = prep;
        activeDisplayFile = filePath;

        const proc = spawn(prep.pythonExec, ['-u', prep.targetFile], {
          cwd: prep.cwd,
          env: prep.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        activeProc = proc;

        ws.send(JSON.stringify({ type: 'started', file: filePath, mode: 'run' }));

        proc.stdout?.on('data', (chunk: Buffer) => {
          ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString('utf-8') }));
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
          const text = remapTracebackToOriginal(
            chunk.toString('utf-8'),
            prep.targetFile,
            activeDisplayFile,
            prep.lineMap
          );
          ws.send(JSON.stringify({ type: 'stderr', data: text }));
        });

        proc.on('close', async (code) => {
          await prep.cleanup();
          if (activeProc === proc) {
            activeProc = null;
            activePrep = null;
          }
          ws.send(JSON.stringify({ type: 'exited', code: code ?? 0 }));
        });
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'stderr', data: `Execution error: ${err.message}\n` }));
        ws.send(JSON.stringify({ type: 'exited', code: 1 }));
      }
      return;
    }

    if (msg.type === 'debug') {
      await cleanupProc();
      const { workspaceId, filePath, content, mode, breakpoints, watches, stopOnEntry } = msg;
      try {
        const prep = await preparePythonFile(workspaceId, filePath, content, mode);
        activePrep = prep;
        activeDisplayFile = filePath;

        const proc = spawnDebuggerProcess(
          prep,
          filePath,
          breakpoints || [],
          watches || [],
          Boolean(stopOnEntry)
        );
        activeProc = proc;

        proc.stdout?.on('data', (chunk: Buffer) => {
          ws.send(JSON.stringify({ type: 'stdout', data: chunk.toString('utf-8') }));
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
          const text = remapTracebackToOriginal(
            chunk.toString('utf-8'),
            prep.targetFile,
            activeDisplayFile,
            prep.lineMap
          );
          ws.send(JSON.stringify({ type: 'stderr', data: text }));
        });

        // FD 4 emits JSON debugger events
        const evtStream = proc.stdio[4] as NodeJS.ReadableStream | undefined;
        let buffer = '';
        evtStream?.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              ws.send(JSON.stringify({ type: 'debug_event', event: evt }));
            } catch {
              // ignore
            }
          }
        });

        proc.on('close', async (code) => {
          await prep.cleanup();
          if (activeProc === proc) {
            activeProc = null;
            activePrep = null;
          }
          ws.send(JSON.stringify({ type: 'exited', code: code ?? 0 }));
        });
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'stderr', data: `Debugger error: ${err.message}\n` }));
        ws.send(JSON.stringify({ type: 'exited', code: 1 }));
      }
      return;
    }

    if (msg.type === 'stdin' && activeProc?.stdin) {
      activeProc.stdin.write(String(msg.data ?? '') + '\n');
      return;
    }

    if (msg.type === 'debug_cmd' && activeProc) {
      const cmdPipe = activeProc.stdio[3] as NodeJS.WritableStream | undefined;
      cmdPipe?.write(JSON.stringify(msg.cmd) + '\n');
      return;
    }

    if (msg.type === 'stop') {
      await cleanupProc();
      ws.send(JSON.stringify({ type: 'exited', code: -1 }));
    }
  });

  ws.on('close', () => {
    cleanupProc().catch(() => {});
  });
}

startServer().catch((err) => {
  console.error('Failed to start CONDO IDE server:', err);
  process.exit(1);
});
