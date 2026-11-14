import React, { useState } from 'react';
import { ArrowLeftRight, Code2, Send, Sparkles, Wand2, Wrench } from 'lucide-react';

interface AiAssistantPanelProps {
  activeFilePath: string | null;
  activeCode: string;
  activeLanguage: string;
  onInsertCode: (code: string) => void;
  onReplaceCode: (code: string) => void;
  onCollectProjectContext: () => Promise<Array<{ path: string; content: string }>>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  codeBlock?: string;
}

function extractFirstCodeBlock(markdown: string): string | undefined {
  const match = /```[a-zA-Z0-9_-]*\n([\s\S]*?)```/.exec(markdown);
  return match ? match[1].trimEnd() : undefined;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  activeFilePath,
  activeCode,
  activeLanguage,
  onInsertCode,
  onReplaceCode,
  onCollectProjectContext,
}) => {
  const [prompt, setPrompt] = useState('');
  const [includeWorkspace, setIncludeWorkspace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'CONDO AI ready. Ask to generate, explain, fix, refactor, or convert between Python and PyID (.cdo).',
    },
  ]);

  const runAction = async (
    action:
      | 'generate'
      | 'explain'
      | 'fix'
      | 'refactor'
      | 'to_pyid'
      | 'to_python'
      | 'chat',
    customPrompt?: string
  ) => {
    const userLabel =
      customPrompt ||
      ({
        generate: 'Generate code',
        explain: `Explain ${activeFilePath || 'active code'}`,
        fix: `Fix errors in ${activeFilePath || 'active code'}`,
        refactor: `Refactor ${activeFilePath || 'active code'}`,
        to_pyid: 'Convert Python to PyID',
        to_python: 'Convert PyID to Python',
        chat: prompt,
      }[action] || action);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: userLabel },
    ]);
    setLoading(true);

    try {
      const projectContext = includeWorkspace ? await onCollectProjectContext() : undefined;
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          prompt: customPrompt || prompt,
          code: activeCode,
          language: activeLanguage,
          fileName: activeFilePath,
          projectContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: 'error', text: data.error || 'Request failed' },
        ]);
      } else {
        const text = data.text || '';
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text,
            codeBlock: extractFirstCodeBlock(text),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'error',
          text: err?.message || 'Network error contacting AI backend',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
            <span>AI Assistant</span>
          </div>
        </div>

        {/* Quick Action Grid */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction('explain')}
            className="px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-teal-500/20 text-left flex items-center gap-1"
          >
            <Code2 className="w-3 h-3 text-teal-500 shrink-0" />
            <span className="truncate">Explain</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction('fix')}
            className="px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-teal-500/20 text-left flex items-center gap-1"
          >
            <Wrench className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">Fix Error</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction('refactor')}
            className="px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-teal-500/20 text-left flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3 text-cyan-500 shrink-0" />
            <span className="truncate">Refactor</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              runAction(activeLanguage === 'pyid' ? 'to_python' : 'to_pyid')
            }
            className="px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-teal-500/20 text-left flex items-center gap-1"
          >
            <ArrowLeftRight className="w-3 h-3 text-teal-500 shrink-0" />
            <span className="truncate">
              {activeLanguage === 'pyid' ? 'To Python' : 'To PyID'}
            </span>
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeWorkspace}
            onChange={(e) => setIncludeWorkspace(e.target.checked)}
            className="accent-teal-500"
          />
          <span>Allow reading workspace files for context</span>
        </label>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded-lg text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-teal-600/15 text-slate-800 dark:text-slate-100 ml-4'
                : m.role === 'error'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                : 'bg-slate-200/60 dark:bg-[#0d1526] text-slate-700 dark:text-slate-200'
            }`}
          >
            <div className="whitespace-pre-wrap break-words font-sans">{m.text}</div>
            {m.codeBlock && (
              <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-300/40 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => onInsertCode(m.codeBlock!)}
                  className="px-2 py-1 rounded bg-teal-600 text-white text-[11px] font-medium"
                >
                  Insert at Cursor
                </button>
                <button
                  type="button"
                  onClick={() => onReplaceCode(m.codeBlock!)}
                  className="px-2 py-1 rounded bg-slate-300 dark:bg-slate-700 text-[11px] font-medium"
                >
                  Replace File
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-[11px] text-teal-500 px-2">CONDO AI is thinking...</div>
        )}
      </div>

      {/* Prompt Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!prompt.trim() || loading) return;
          const q = prompt.trim();
          setPrompt('');
          runAction('chat', q);
        }}
        className="p-2 border-t border-slate-200 dark:border-slate-800 flex gap-1.5"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask CONDO AI to generate or explain..."
          aria-label="AI Assistant prompt"
          className="flex-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-xs outline-none focus:border-teal-500"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          aria-label="Send message to AI Assistant"
          className="px-2.5 py-1.5 rounded-md bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
