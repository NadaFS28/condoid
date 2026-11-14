import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GitCommit, GitFileStatus, GitStatusResponse } from '../src/shared/types';
import { workspaceManager } from './workspaceManager';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]) {
  return execFileAsync('git', args, { cwd, timeout: 30000 });
}

export async function getGitStatus(workspaceId: string): Promise<GitStatusResponse> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const gitDir = path.join(wsDir, '.git');
  try {
    const stat = await fs.stat(gitDir);
    if (!stat.isDirectory()) throw new Error('Not a repo');
  } catch {
    return {
      initialized: false,
      branch: '',
      branches: [],
      files: [],
      commits: [],
    };
  }

  let branch = 'main';
  try {
    const { stdout } = await runGit(wsDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    branch = stdout.trim() || 'main';
  } catch {
    try {
      const { stdout } = await runGit(wsDir, ['symbolic-ref', '--short', 'HEAD']);
      branch = stdout.trim() || 'main';
    } catch {
      branch = 'main';
    }
  }

  let branches: string[] = [];
  try {
    const { stdout } = await runGit(wsDir, ['branch', '--format=%(refname:short)']);
    branches = stdout
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);
  } catch {
    branches = [branch];
  }

  const files: GitFileStatus[] = [];
  try {
    const { stdout } = await runGit(wsDir, ['status', '--porcelain=v1']);
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const indexStatus = line[0] || ' ';
      const workingStatus = line[1] || ' ';
      const filePath = line.slice(3).trim();
      files.push({
        path: filePath,
        indexStatus,
        workingStatus,
        staged: indexStatus !== ' ' && indexStatus !== '?',
      });
    }
  } catch {
    // ignore
  }

  const commits: GitCommit[] = [];
  try {
    const { stdout } = await runGit(wsDir, [
      'log',
      '-n',
      '20',
      '--pretty=format:%h|%an|%ar|%s',
    ]);
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const [hash, author, date, ...msgParts] = line.split('|');
      commits.push({
        hash,
        author,
        date,
        message: msgParts.join('|'),
      });
    }
  } catch {
    // No commits yet
  }

  let remoteUrl: string | undefined;
  try {
    const { stdout } = await runGit(wsDir, ['remote', 'get-url', 'origin']);
    remoteUrl = stdout.trim() || undefined;
  } catch {
    remoteUrl = undefined;
  }

  return {
    initialized: true,
    branch,
    branches: branches.length > 0 ? branches : [branch],
    files,
    commits,
    remoteUrl,
  };
}

export async function gitInit(workspaceId: string): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const { stdout } = await runGit(wsDir, ['init', '-b', 'main']);
  // Ensure local repo has user config so commits work cleanly out of the box
  await runGit(wsDir, ['config', 'user.name', 'CONDO Developer']).catch(() => {});
  await runGit(wsDir, ['config', 'user.email', 'dev@condo-ide.local']).catch(() => {});
  return stdout.trim();
}

export async function gitStage(workspaceId: string, filePath?: string): Promise<void> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  await runGit(wsDir, ['add', filePath || '.']);
}

export async function gitUnstage(workspaceId: string, filePath: string): Promise<void> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  try {
    await runGit(wsDir, ['reset', 'HEAD', '--', filePath]);
  } catch {
    await runGit(wsDir, ['rm', '--cached', '--', filePath]);
  }
}

export async function gitCommit(workspaceId: string, message: string): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  await runGit(wsDir, ['config', 'user.name', 'CONDO Developer']).catch(() => {});
  await runGit(wsDir, ['config', 'user.email', 'dev@condo-ide.local']).catch(() => {});
  const { stdout } = await runGit(wsDir, ['commit', '-m', message]);
  return stdout.trim();
}

export async function gitBranchCreateOrSwitch(
  workspaceId: string,
  branchName: string,
  create: boolean
): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const args = create ? ['checkout', '-b', branchName] : ['checkout', branchName];
  const { stdout, stderr } = await runGit(wsDir, args);
  return (stdout + '\n' + stderr).trim();
}

export async function gitMerge(workspaceId: string, sourceBranch: string): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const { stdout, stderr } = await runGit(wsDir, ['merge', sourceBranch]);
  return (stdout + '\n' + stderr).trim();
}

export async function gitDiff(workspaceId: string, filePath?: string): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const args = filePath ? ['diff', '--', filePath] : ['diff'];
  const { stdout } = await runGit(wsDir, args);
  if (!stdout.trim() && filePath) {
    const { stdout: cached } = await runGit(wsDir, ['diff', '--cached', '--', filePath]);
    return cached;
  }
  return stdout;
}

export async function gitCloneIntoWorkspace(
  workspaceId: string,
  repoUrl: string
): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  const folderName =
    repoUrl.split('/').pop()?.replace(/\.git$/, '') || `repo-${Date.now()}`;
  const targetDir = workspaceManager.resolveSafePath(workspaceId, folderName);
  const { stdout, stderr } = await execFileAsync(
    'git',
    ['clone', '--depth', '1', repoUrl, targetDir],
    { cwd: wsDir, timeout: 60000 }
  );
  return (stdout + '\n' + stderr).trim();
}

export async function gitPullOrPush(
  workspaceId: string,
  action: 'pull' | 'push',
  remoteUrl?: string
): Promise<string> {
  const wsDir = workspaceManager.getWorkspaceDir(workspaceId);
  if (remoteUrl) {
    try {
      await runGit(wsDir, ['remote', 'set-url', 'origin', remoteUrl]);
    } catch {
      await runGit(wsDir, ['remote', 'add', 'origin', remoteUrl]);
    }
  }
  const { stdout, stderr } = await runGit(wsDir, [action, 'origin', 'HEAD']);
  return (stdout + '\n' + stderr).trim();
}
