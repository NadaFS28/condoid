import { GoogleGenAI } from '@google/genai';
import express from 'express';

const router = express.Router();

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

router.post('/assist', async (req, res) => {
  try {
    const ai = getClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. Add your key in the environment secrets panel to use the AI Assistant.',
      });
      return;
    }

    const { action, prompt, code, language, fileName, projectContext } = req.body as {
      action:
        | 'generate'
        | 'explain'
        | 'fix'
        | 'refactor'
        | 'to_pyid'
        | 'to_python'
        | 'chat';
      prompt?: string;
      code?: string;
      language?: string;
      fileName?: string;
      projectContext?: Array<{ path: string; content: string }>;
    };

    const pyidSpec = `
Python Indonesia (PyID) keyword mapping:
if=jika, elif=lain_jika, else=lainnya, while=selama, for=untuk, def=fungsi, return=kembalikan,
print=tampilkan, input=masukan, True=Benar, False=Salah, None=Kosong, import=impor, from=dari,
as=sebagai, class=kelas, try=coba, except=kecuali, finally=akhirnya, with=dengan,
and=dan, or=atau, not=bukan, in=dalam, is=adalah, pass=lewati, break=berhenti, continue=lanjut, raise=angkat.
`;

    let instruction = '';
    switch (action) {
      case 'generate':
        instruction = `Generate clean, production-ready ${language === 'pyid' ? 'PyID (.cdo)' : 'Python 3'} code for the user's request. Return code inside a single fenced code block followed by a brief explanation.`;
        break;
      case 'explain':
        instruction = `Explain what this code does clearly and concisely, including time/space complexity or potential edge cases.`;
        break;
      case 'fix':
        instruction = `Diagnose and fix bugs or syntax errors in this code. Return the corrected code in a fenced code block and list what was fixed.`;
        break;
      case 'refactor':
        instruction = `Refactor this code for clarity, modularity, and best practices while preserving behavior. Return the refactored code in a fenced code block.`;
        break;
      case 'to_pyid':
        instruction = `Convert the given Python code accurately into Python Indonesia (PyID) using the exact PyID keywords. Return the converted code in a fenced code block.`;
        break;
      case 'to_python':
        instruction = `Convert the given Python Indonesia (PyID) code accurately into standard Python 3. Return the converted code in a fenced code block.`;
        break;
      default:
        instruction = `You are CONDO AI, an expert Python and Python Indonesia (PyID) software engineering assistant inside CONDO IDE.`;
    }

    const contextBlock =
      projectContext && projectContext.length > 0
        ? `\n\nPermitted workspace context:\n${projectContext
            .slice(0, 6)
            .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 4000)}`)
            .join('\n\n')}`
        : '';

    const activeCodeBlock = code
      ? `\n\nActive file (${fileName || 'untitled'}, mode=${language || 'python'}):\n\`\`\`\n${code}\n\`\`\``
      : '';

    const fullPrompt = `${instruction}\n${pyidSpec}${contextBlock}${activeCodeBlock}\n\nUser request:\n${prompt || action}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: fullPrompt,
      config: {
        systemInstruction:
          'You are a concise, senior Python & PyID IDE assistant inside CONDO IDE. Always prioritize runnable, idiomatic code.',
      },
    });

    res.json({ text: response.text ?? '' });
  } catch (err: any) {
    const msg = err?.message || 'AI Assistant request failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
