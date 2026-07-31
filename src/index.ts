import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import pdfParse from 'pdf-parse';
import { contractPrompt } from './prompts';

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

type DocumentEntry = {
  id: string;
  title: string;
  owner: string;
  content: string;
  createdAt: string;
};

const documents: DocumentEntry[] = [
  {
    id: 'doc-1',
    title: 'Sample Contract - Joe',
    owner: 'Joe Public',
    content: 'This is a sample contract stored as dummy data.',
    createdAt: new Date().toISOString(),
  },
];

async function callGemini(prompt: string, opts: Record<string, any> = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Default to Gemini 1.5 Flash if GEMINI_API_URL isn't set
  const apiUrl =
    process.env.GEMINI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  if (apiKey && apiUrl && typeof fetch !== 'undefined') {
    try {
      // Pass the API key in the URL search params, not the Authorization header
      const resp = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Gemini REST API expects the body wrapped in 'contents'
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          ...opts,
        }),
      });

      const data = await resp.json();
      
      // Extract generated text from the standard Gemini API response structure
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        JSON.stringify(data);

      return { model: 'gemini', prompt, response: text };
    } catch (err) {
      return {
        model: 'gemini-error',
        prompt,
        response: `Gemini call failed: ${String(err)}`,
      };
    }
  }

  return {
    model: 'gemini-placeholder',
    prompt,
    response: `(Gemini placeholder) Response for prompt: ${prompt.slice(0, 200)}`,
  };
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.post('/auth/login', (req: Request, res: Response) => {
  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const username = typeof body.username === 'string' ? body.username : 'demo';
  const password = typeof body.password === 'string' ? body.password : 'demo';

  const token = Buffer.from(JSON.stringify({ username, password, role: 'user' })).toString('base64');

  res.json({
    token,
    access: 'granted',
    user: { username, password },
  });
});

app.post('/ai/documents/summarize', async (req: Request, res: Response) => {
  const { text } = req.body || {};
  const ai = await callGemini(`Summarize: ${text || 'no text'}`);
  res.json({ summary: ai.response, author: 'Joe Public' });
});

app.post('/ai/documents/timeline', async (req: Request, res: Response) => {
  const { text } = req.body || {};
  const ai = await callGemini(`Extract timeline from: ${text || 'no text'}`);
  res.json({ timeline: [
    { date: '2026-01-01', event: 'Signed by Joe' },
    { date: '2026-02-01', event: ai.response },
  ] });
});

app.post('/pdf/process-document', upload.single('file'), (req: Request, res: Response) => {
  (async () => {
    try {
      const id = `doc-${Date.now()}`;
      const file = req.file;
      let text = req.body.text || '';

      if (file && file.buffer) {
        const data = await pdfParse(file.buffer);
        text = data?.text || text;
      }

      if (!text || !text.trim()) return res.status(400).json({ error: 'No readable text found' });

      const entry: DocumentEntry = {
        id,
        title: req.body.title || 'Uploaded Document',
        owner: 'Joe Public',
        content: text,
        createdAt: new Date().toISOString(),
      };
      documents.push(entry);
      res.json({ id, message: 'processed', textSnippet: text.slice(0, 400) });
    } catch (err: any) {
      res.status(500).json({ error: String(err.message || err) });
    }
  })();
});

// Generate PDF from content and return base64
app.post('/pdf/download-pdf', async (req: Request, res: Response) => {
  try {
    const { content = '', filename = 'legal_document.pdf' } = req.body || {};
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => {
      const buf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buf.toString('base64'));
    });

    doc.fontSize(12).text(content || '');
    doc.end();
  } catch (err: any) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/ai/drafts/generate', async (req: Request, res: Response) => {
  const { prompt } = req.body || {};
  const ai = await callGemini(`Generate draft: ${prompt || ''}`);
  res.json({ draft: `Draft generated for Joe:\n\n${ai.response}` });
});

app.post('/ai/draft/enhance', async (req: Request, res: Response) => {
  const { draft } = req.body || {};
  const ai = await callGemini(`Enhance draft: ${draft || ''}`);
  res.json({ enhanced: `${ai.response}\n(Enhanced for Joe)` });
});

app.post('/ai/draft/clause', async (req: Request, res: Response) => {
  const { context } = req.body || {};
  const ai = await callGemini(`Create clause: ${context || ''}`);
  res.json({ clause: `${ai.response}\n-- Clause by Joe` });
});

app.post('/ai/contracts/analyze', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let text = req.body.contract || '';
    const file = req.file;
    if (file && file.buffer) {
      const data = await pdfParse(file.buffer);
      text = data?.text || text;
    }

    if (!text || !text.trim()) return res.status(400).json({ error: 'No contract text provided' });

    const prompt = `${contractPrompt}\n\n${text}`;
    const ai = await callGemini(prompt, { model: process.env.GEMINI_MODEL || 'gemini-2.0' });

    // Try to parse JSON from response
    let parsed: any = null;
    const raw = ai.response || '';
    const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: raw };
    }

    res.json({ analysis: parsed });
  } catch (err: any) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/ai/research/cases', async (req: Request, res: Response) => {
  const { query } = req.body || {};
  const ai = await callGemini(`Search cases for: ${query || ''}`);
  res.json({ results: [ { title: 'Joe v State', snippet: ai.response } ] });
});

app.post('/ai/research/definitions', async (req: Request, res: Response) => {
  const { term } = req.body || {};
  const ai = await callGemini(`Definition: ${term || ''}`);
  res.json({ definitions: [ { term, definition: ai.response } ] });
});

app.post('/ai/research/bare-act', async (req: Request, res: Response) => {
  const { query } = req.body || {};
  const ai = await callGemini(`Bare act search: ${query || ''}`);
  res.json({ matches: [ ai.response ] });
});

app.post('/ai/research/citation', async (req: Request, res: Response) => {
  const { details } = req.body || {};
  const ai = await callGemini(`Generate citation: ${details || ''}`);
  res.json({ citation: `Citation (Joe): ${ai.response}` });
});

app.post('/ai/litigation/counter-argument', async (req: Request, res: Response) => {
  const { argument } = req.body || {};
  const ai = await callGemini(`Counter-argument: ${argument || ''}`);
  res.json({ counter: ai.response });
});

app.post('/ai/litigation/predict-outcome', async (req: Request, res: Response) => {
  const { facts } = req.body || {};
  const ai = await callGemini(`Predict outcome: ${facts || ''}`);
  res.json({ prediction: 'Unlikely to succeed', confidence: 0.32, note: ai.response });
});

app.post('/ai/documents/query', async (req: Request, res: Response) => {
  const { docId, query } = req.body || {};
  const ai = await callGemini(`Query doc ${docId}: ${query || ''}`);
  res.json({ answer: ai.response });
});

app.post('/pdf/save-doc', (req: Request, res: Response) => {
  const { title, content } = req.body || {};
  const id = `doc-${Date.now()}`;
  const entry: DocumentEntry = { id, title: title || 'Untitled (Joe)', content: content || '', owner: 'Joe Public', createdAt: new Date().toISOString() };
  documents.push(entry);
  res.json({ id, message: 'saved (dummy)' });
});

app.get('/pdf/get-docs', (_req: Request, res: Response) => {
  res.json({ docs: documents });
});

app.post('/ai/ask', async (req: Request, res: Response) => {
  const { question } = req.body || {};
  const ai = await callGemini(`Ask: ${question || ''}`);
  res.json({ answer: `Joe says: ${ai.response}` });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WholeLexora backend listening on http://0.0.0.0:${PORT}/api`);
});
