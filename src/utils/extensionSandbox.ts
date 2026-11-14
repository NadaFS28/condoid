import type { CondoExtension, ExtensionPermission } from '../shared/types';

export interface ExtensionSandboxContext {
  getActiveCode: () => string;
  insertCodeAtCursor: (text: string) => void;
  notify: (msg: string) => void;
}

/**
 * Enforces declared extension permissions before allowing command execution.
 */
export function executeSandboxedExtensionCommand(
  ext: CondoExtension,
  commandId: string,
  ctx: ExtensionSandboxContext
): { ok: boolean; error?: string } {
  if (!ext.installed || !ext.enabled) {
    return { ok: false, error: `Extension "${ext.name}" is disabled or not installed.` };
  }

  const cmd = ext.commands?.find((c) => c.id === commandId);
  if (!cmd) {
    return { ok: false, error: `Command "${commandId}" not found.` };
  }

  const hasPermission = (perm: ExtensionPermission) => ext.permissions.includes(perm);

  if (cmd.insertText) {
    if (!hasPermission('editor:write') && !hasPermission('commands:register')) {
      return {
        ok: false,
        error: `Sandbox blocked "${ext.name}": missing editor:write or commands:register permission.`,
      };
    }
    ctx.insertCodeAtCursor(cmd.insertText);
    ctx.notify(`Executed "${cmd.title}" via sandboxed extension ${ext.name}`);
    return { ok: true };
  }

  return { ok: true };
}
