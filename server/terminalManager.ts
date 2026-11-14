import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { WebSocket } from 'ws';
import { resolvePythonExecutable } from './pythonRunner';
import { workspaceManager } from './workspaceManager';

interface TerminalSession {
  id: string;
  proc: ChildProcess;
  ws: WebSocket;
}

const sessions = new Map<string, TerminalSession>();

export async function attachTerminalSession(
  ws: WebSocket,
  workspaceId: string,
  sessionId: string,
  mode: 'bash' | 'python'
): Promise<void> {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.proc.kill('SIGTERM');
    sessions.delete(sessionId);
  }

  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const pythonExec = await resolvePythonExecutable(workspaceId);
  const bridgePath = path.resolve(process.cwd(), 'server', 'pty_bridge.py');

  // FD 0,1,2 for PTY I/O, FD 3 for resize/signal JSON messages
  const proc = spawn('python3', ['-u', bridgePath, mode, wsDir, pythonExec], {
    cwd: wsDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
  });

  sessions.set(sessionId, { id: sessionId, proc, ws });

  proc.stdout?.on('data', (chunk: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data: chunk.toString('utf-8') }));
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data: chunk.toString('utf-8') }));
    }
  });

  proc.on('close', (code) => {
    sessions.delete(sessionId);
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'exit',
          code: code ?? 0,
        })
      );
    }
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input' && typeof msg.data === 'string') {
        proc.stdin?.write(msg.data);
      } else if (msg.type === 'resize' && msg.cols && msg.rows) {
        const ctrlPipe = proc.stdio[3] as NodeJS.WritableStream | undefined;
        ctrlPipe?.write(
          JSON.stringify({ type: 'resize', cols: msg.cols, rows: msg.rows }) + '\n'
        );
      } else if (msg.type === 'sigint') {
        const ctrlPipe = proc.stdio[3] as NodeJS.WritableStream | undefined;
        ctrlPipe?.write(JSON.stringify({ type: 'signal' }) + '\n');
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    const sess = sessions.get(sessionId);
    if (sess && sess.ws === ws) {
      sess.proc.kill('SIGTERM');
      sessions.delete(sessionId);
    }
  });
}
