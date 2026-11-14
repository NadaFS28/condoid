/**
 * File System Access API integration with graceful fallback when running
 * in unsupported browsers or restricted iframe sandboxes.
 */

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function'
  );
}

export interface LocalFileEntry {
  path: string;
  content: string;
}

export async function openLocalFolder(): Promise<{
  folderName: string;
  handle: any;
  files: LocalFileEntry[];
}> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('UNSUPPORTED_FS_ACCESS');
  }

  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  const files: LocalFileEntry[] = [];

  const readDir = async (handle: any, prefix: string) => {
    for await (const [name, entry] of handle.entries()) {
      if (name === '.git' || name === '__pycache__' || name === 'node_modules' || name === '.venv') {
        continue;
      }
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'directory') {
        await readDir(entry, relPath);
      } else if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (file.size <= 1024 * 1024) {
          const content = await file.text();
          files.push({ path: relPath, content });
        }
      }
    }
  };

  await readDir(dirHandle, '');
  return { folderName: dirHandle.name, handle: dirHandle, files };
}

export async function writeToLocalDirHandle(
  dirHandle: any,
  relPath: string,
  content: string
): Promise<boolean> {
  if (!dirHandle) return false;
  try {
    const parts = relPath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return false;
    let cur = dirHandle;
    for (const dir of parts) {
      cur = await cur.getDirectoryHandle(dir, { create: true });
    }
    const fileHandle = await cur.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function saveFileAsLocal(
  suggestedName: string,
  content: string
): Promise<boolean> {
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
      // Fall through to blob download if blocked by iframe policy
    }
  }

  downloadBlobFile(suggestedName, content);
  return true;
}

export function downloadBlobFile(filename: string, content: string | Blob): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
