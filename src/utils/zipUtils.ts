import JSZip from 'jszip';

export async function importZipArchive(
  file: File
): Promise<Array<{ path: string; content: string }>> {
  const zip = await JSZip.loadAsync(file);
  const extracted: Array<{ path: string; content: string }> = [];

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const cleanPath = entry.name.replace(/^\/+/, '');
    if (
      cleanPath.includes('__MACOSX') ||
      cleanPath.includes('.git/') ||
      cleanPath.includes('__pycache__/')
    ) {
      continue;
    }
    const content = await entry.async('string');
    extracted.push({ path: cleanPath, content });
  }

  // If everything was nested inside one top-level folder, strip that prefix cleanly
  if (extracted.length > 0) {
    const firstSegs = extracted.map((f) => f.path.split('/')[0]);
    const allShareRoot =
      extracted.every((f) => f.path.includes('/')) &&
      firstSegs.every((s) => s === firstSegs[0]);
    if (allShareRoot) {
      const prefix = firstSegs[0] + '/';
      return extracted.map((f) => ({
        path: f.path.slice(prefix.length),
        content: f.content,
      }));
    }
  }

  return extracted;
}

export async function exportZipArchive(
  projectName: string,
  files: Array<{ path: string; content: string }>
): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.path, f.content);
  }
  return zip.generateAsync({ type: 'blob' });
}
