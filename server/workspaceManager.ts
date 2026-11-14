import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_TEMPLATES } from '../src/shared/templates';
import type {
  CondoProjectConfig,
  FileNode,
  SearchMatch,
  WorkspaceSummary,
} from '../src/shared/types';

const WORKSPACES_ROOT = path.resolve(process.cwd(), 'workspaces');
const META_FILE = path.join(WORKSPACES_ROOT, '.condo-workspaces.json');

export class WorkspaceManager {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
    const list = await this.listWorkspaces();
    if (list.length === 0) {
      await this.createWorkspaceFromTemplate('pyid-starter', 'CONDO-PyID-Starter');
    }
    this.initialized = true;
  }

  private sanitizeId(raw: string): string {
    const clean = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return clean || `workspace-${Date.now()}`;
  }

  getWorkspaceDir(workspaceId: string): string {
    const safeId = path.basename(workspaceId);
    const full = path.resolve(WORKSPACES_ROOT, safeId);
    if (!full.startsWith(WORKSPACES_ROOT + path.sep)) {
      throw new Error('Invalid workspace identifier');
    }
    return full;
  }

  resolveSafePath(workspaceId: string, relPath: string): string {
    const wsDir = this.getWorkspaceDir(workspaceId);
    const normalizedRel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const target = path.resolve(wsDir, normalizedRel);
    if (target !== wsDir && !target.startsWith(wsDir + path.sep)) {
      throw new Error('Access denied: path escapes workspace sandbox');
    }
    return target;
  }

  private async readMeta(): Promise<WorkspaceSummary[]> {
    try {
      const raw = await fs.readFile(META_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeMeta(items: WorkspaceSummary[]): Promise<void> {
    await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
    await fs.writeFile(META_FILE, JSON.stringify(items, null, 2), 'utf-8');
  }

  async listWorkspaces(): Promise<WorkspaceSummary[]> {
    await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
    const meta = await this.readMeta();
    const valid: WorkspaceSummary[] = [];
    for (const ws of meta) {
      try {
        const stat = await fs.stat(this.getWorkspaceDir(ws.id));
        if (stat.isDirectory()) {
          valid.push(ws);
        }
      } catch {
        // Skip deleted folder
      }
    }
    return valid.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  }

  async createWorkspaceFromTemplate(
    templateId: string,
    customName?: string
  ): Promise<WorkspaceSummary> {
    const template =
      PROJECT_TEMPLATES.find((t) => t.id === templateId) || PROJECT_TEMPLATES[0];
    const displayName = customName?.trim() || template.name;
    let id = this.sanitizeId(displayName);
    const existing = await this.listWorkspaces();
    if (existing.some((w) => w.id === id)) {
      id = `${id}-${Date.now().toString(36)}`;
    }

    const wsDir = this.getWorkspaceDir(id);
    await fs.mkdir(wsDir, { recursive: true });

    for (const [relPath, content] of Object.entries(template.files)) {
      const target = this.resolveSafePath(id, relPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf-8');
    }

    const summary: WorkspaceSummary = {
      id,
      name: displayName,
      path: wsDir,
      lastOpenedAt: Date.now(),
      defaultLanguage: template.mode,
    };

    await this.writeMeta([summary, ...existing.filter((w) => w.id !== id)]);
    return summary;
  }

  async touchWorkspace(workspaceId: string): Promise<void> {
    const existing = await this.readMeta();
    const updated = existing.map((w) =>
      w.id === workspaceId ? { ...w, lastOpenedAt: Date.now() } : w
    );
    await this.writeMeta(updated);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const wsDir = this.getWorkspaceDir(workspaceId);
    await fs.rm(wsDir, { recursive: true, force: true });
    const existing = await this.readMeta();
    await this.writeMeta(existing.filter((w) => w.id !== workspaceId));
  }

  async getFileTree(workspaceId: string): Promise<FileNode[]> {
    const wsDir = this.getWorkspaceDir(workspaceId);
    const buildTree = async (dir: string, relBase: string): Promise<FileNode[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const nodes: FileNode[] = [];
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === '__pycache__' || entry.name === '.condo-tmp') {
          continue;
        }
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const children =
            entry.name === '.venv' ? [] : await buildTree(fullPath, relPath);
          nodes.push({
            name: entry.name,
            path: relPath,
            type: 'folder',
            children,
          });
        } else {
          const stat = await fs.stat(fullPath);
          nodes.push({
            name: entry.name,
            path: relPath,
            type: 'file',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
          });
        }
      }
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    };
    return buildTree(wsDir, '');
  }

  async readFile(workspaceId: string, relPath: string): Promise<string> {
    const full = this.resolveSafePath(workspaceId, relPath);
    return fs.readFile(full, 'utf-8');
  }

  async writeFile(workspaceId: string, relPath: string, content: string): Promise<void> {
    const full = this.resolveSafePath(workspaceId, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf-8');
  }

  async createFolder(workspaceId: string, relPath: string): Promise<void> {
    const full = this.resolveSafePath(workspaceId, relPath);
    await fs.mkdir(full, { recursive: true });
  }

  async renamePath(workspaceId: string, oldRel: string, newRel: string): Promise<void> {
    const src = this.resolveSafePath(workspaceId, oldRel);
    const dst = this.resolveSafePath(workspaceId, newRel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
  }

  async copyPath(workspaceId: string, srcRel: string, dstRel: string): Promise<void> {
    const src = this.resolveSafePath(workspaceId, srcRel);
    const dst = this.resolveSafePath(workspaceId, dstRel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.cp(src, dst, { recursive: true });
  }

  async deletePath(workspaceId: string, relPath: string): Promise<void> {
    const full = this.resolveSafePath(workspaceId, relPath);
    if (full === this.getWorkspaceDir(workspaceId)) {
      throw new Error('Cannot delete workspace root');
    }
    await fs.rm(full, { recursive: true, force: true });
  }

  async getProjectConfig(workspaceId: string): Promise<CondoProjectConfig | null> {
    try {
      const raw = await this.readFile(workspaceId, 'condo.cdoproj');
      return JSON.parse(raw) as CondoProjectConfig;
    } catch {
      return null;
    }
  }

  async searchInWorkspace(
    workspaceId: string,
    query: string,
    options: { caseSensitive?: boolean; regex?: boolean } = {}
  ): Promise<SearchMatch[]> {
    if (!query) return [];
    const matches: SearchMatch[] = [];
    const wsDir = this.getWorkspaceDir(workspaceId);

    let matcher: RegExp;
    try {
      const flags = options.caseSensitive ? 'g' : 'gi';
      const pattern = options.regex
        ? query
        : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matcher = new RegExp(pattern, flags);
    } catch {
      return [];
    }

    const walk = async (dir: string, relBase: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.name === '.git' ||
          entry.name === '__pycache__' ||
          entry.name === '.venv' ||
          entry.name === '.condo-tmp'
        ) {
          continue;
        }
        const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, rel);
        } else {
          try {
            const stat = await fs.stat(full);
            if (stat.size > 512 * 1024) continue;
            const text = await fs.readFile(full, 'utf-8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
              matcher.lastIndex = 0;
              const m = matcher.exec(lines[i]);
              if (m) {
                matches.push({
                  path: rel,
                  line: i + 1,
                  column: m.index + 1,
                  text: lines[i].trim().slice(0, 160),
                });
                if (matches.length >= 250) return;
              }
            }
          } catch {
            // Skip unreadable/binary
          }
        }
      }
    };

    await walk(wsDir, '');
    return matches;
  }
}

export const workspaceManager = new WorkspaceManager();
