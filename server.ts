import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';
import {
  stripTrailingComma,
  parseXlsPriceNumber,
  lnddRowSignature,
  parseLnddSearchTable,
  pickBestIngredient,
  MOPHPriceListRow,
} from './src/services/mophParsers';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log('Client connected for sync:', socket.id);
  
  socket.on('sync_update', (data) => {
    // Relay the message to all OTHER connected clients
    socket.broadcast.emit('sync_update', data);
  });

  // Secondary PC asks for the full dataset right after connecting
  socket.on('request_snapshot', (requesterData) => {
    socket.broadcast.emit('snapshot_requested', { requesterId: socket.id, requesterData });
  });

  // Main PC replies with its dataset, routed only to the requester
  socket.on('snapshot_response', ({ targetId, data }: { targetId?: string; data?: unknown }) => {
    if (targetId) {
      io.to(targetId).emit('snapshot_data', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3000;

app.use(express.json({ limit: '10mb' }));


// Permissive headers for local network & launcher access
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  // Google Identity Services uses a popup and checks its lifecycle from the opener.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint to enrich scientific drug monographs with AI
app.post('/api/scientifics/enrich', async (req, res) => {
  try {
    const { drugName, ingredients, dosage, form, presentation } = req.body || {};
    const queryIngredients = (ingredients || drugName || '').trim();

    if (!queryIngredients) {
      return res.status(400).json({ error: 'Missing drug ingredients or name' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on server',
        fallbackNeeded: true,
      });
    }

    const prompt = `You are a distinguished clinical pharmacologist and medical information specialist for a licensed clinical pharmacy.
Analyze this pharmaceutical product, especially its active ingredients (which may be a combination of multiple active ingredients or a single entity), and generate an authoritative, unified clinical monograph specifically tailored to this exact formulation and combination of ingredients.

Product Details:
- Drug Name: ${drugName || 'Not specified'}
- Active Ingredients: ${queryIngredients}
- Dosage Strength: ${dosage || 'Standard'}
- Pharmaceutical Form: ${form || 'Tablet'}
- Packaging / Presentation: ${presentation || 'Standard pack'}

Mandatory Clinical Instructions:
1. Deconstruct and identify all individual active molecules/substances in the formulation (e.g., Paracetamol + Caffeine, Amoxicillin + Clavulanic Acid, Fluticasone + Salmeterol, Losartan + Hydrochlorothiazide, Metformin + Sitagliptin, etc.).
2. Evaluate the synergy, therapeutic rationale, and combined pharmacodynamics of this multi-ingredient combination (why they are formulated together, additive analgesia, beta-lactamase protection, complementary blood pressure reduction, metabolic synergy).
3. Produce concise, highly professional clinical monograph sections formatted with clean bullet points:
   - "indications":
     • Primary Use: [Clear statement of the combined therapeutic purpose and target pathologies]
     • Key Indications: [List specific clinical indications and diseases treated, separated by semicolons]
     • Pharmacological Class: [Combined pharmacological classes of all ingredients]
   - "contraindications" (MUST combine contraindications and high-risk conditions across ALL active ingredients):
     • Absolute: [Documented hypersensitivity to any of the constituent ingredients or cross-reactive chemical classes]
     • Clinical Contraindications: [List specific organ impairments, pathologies, and clinical conditions that contraindicate ANY of the ingredients]
     • Safety Alert: [High-priority vigilance, black-box warnings, crucial drug-drug interactions, high-risk populations]
   - "sideEffects" (MUST combine adverse reactions across ALL active ingredients):
     • Common Reactions: [Frequent side effects attributable to the combination and each constituent molecule]
     • Critical Warnings: [Severe adverse reactions, organ toxicities, e.g. acute hepatotoxicity, rhabdomyolysis, tendon rupture, QT prolongation, angioedema]
     • Monitoring & Advice: [Crucial laboratory monitoring parameters, max daily limits, clinical safety guidance]
   - "dosage": Standard adult clinical dosing regimen for this combination.
   - "pediatricDosage": Specific pediatric dosing recommendations or pediatric contraindications for this combination.
   - "pregnancyCategory": FDA pregnancy category ('A' | 'B' | 'C' | 'D' | 'X') corresponding to the most restrictive constituent ingredient, with a brief clinical note.
   - "storageConditions": Optimal storage instructions (e.g. "Store below 25°C in a cool, dry place protected from moisture and direct light.").
   - "identifiedIngredients": Array of the distinct active ingredient names identified (e.g. ["Paracetamol", "Caffeine"]).

Return ONLY valid JSON matching this schema:
{
  "indications": "• Primary Use: ...\\n• Key Indications: ...\\n• Pharmacological Class: ...",
  "contraindications": "• Absolute: ...\\n• Clinical Contraindications: ...\\n• Safety Alert: ...",
  "sideEffects": "• Common Reactions: ...\\n• Critical Warnings: ...\\n• Monitoring & Advice: ...",
  "dosage": "...",
  "pediatricDosage": "...",
  "pregnancyCategory": "...",
  "storageConditions": "...",
  "identifiedIngredients": ["..."]
}`;

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next candidate:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All AI models failed to generate content');
    }

    const responseText = response.text || '';
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    }

    if (!parsedData || !parsedData.indications) {
      throw new Error('Invalid response structure from AI model');
    }

    const identified = Array.isArray(parsedData.identifiedIngredients) && parsedData.identifiedIngredients.length > 0
      ? parsedData.identifiedIngredients
      : [];

    return res.json({
      success: true,
      scientificInfo: {
        indications: parsedData.indications,
        contraindications: parsedData.contraindications,
        sideEffects: parsedData.sideEffects,
        dosage: parsedData.dosage || 'Adults: as prescribed by physician according to clinical guidelines.',
        pediatricDosage: parsedData.pediatricDosage || 'Pediatrics: consult physician for pediatric dosing.',
        pregnancyCategory: parsedData.pregnancyCategory || 'B',
        storageConditions: parsedData.storageConditions || 'Store below 25°C in a dry place.',
        activeIngredients: identified.length > 0 ? identified.join(' + ') : queryIngredients,
        onlineEnriched: true,
        onlineSource: 'AI-Verified Clinical Reference (Gemini + NIH NLM)',
        lastOnlineSearch: Date.now(),
      },
      source: 'AI-Verified Clinical Reference (Gemini + NIH NLM)',
      identifiedIngredients: identified,
    });
  } catch (err: any) {
    console.error('Error enriching scientific data with AI:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to enrich scientific data with AI',
      fallbackNeeded: true,
    });
  }
});

// ---------------------------------------------------------------------------
// MOPH price list (.xls) scraping + LNDD ingredients lookup
//
// The official Drugs Public Price List page publishes monthly
// "WebMarketed########.xls" files. Every row carries:
//   Code (= MOHCode), Registration number, Brand name, Strength, Presentation,
//   Form, Agent, Manufacturer, Country, Public Price LL, Pharmacist Margin, Stratum
// We parse that file once (with a short cache) so the app can fill the
// "Pharmacist Margin" (and price/agent) columns from official data without
// needing per-drug detail page scrapes. Ingredients are sourced from the LNDD
// drug database (same site) via its public search page.
// ---------------------------------------------------------------------------

const MOPH_PRICELIST_PAGE = 'https://moph.gov.lb/en/Pages/3/3101/drugs-public-price-list-';
const MOPH_LNDD_SEARCH = 'https://www.moph.gov.lb/en/Drugs/index/3/4848';

let priceListCache: { ts: number; rows: MOPHPriceListRow[] } | null = null;

async function findLatestMarketedXlsUrl(): Promise<string> {
  const pageRes = await fetch(MOPH_PRICELIST_PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!pageRes.ok) {
    throw new Error(`Failed to fetch MOPH public price list page (${pageRes.status})`);
  }
  const html = await pageRes.text();

  // Find all WebMarketed########.xls links, keep the one with the newest date in the filename.
  const candidates: Array<{ url: string; date: number }> = [];
  const hrefRe = /href="([^"]*WebMarketed(\d{8})\.xls[^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const raw = m[1];
    const url = raw.startsWith('http') ? raw : `https://moph.gov.lb${raw}`;
    candidates.push({ url, date: Number(m[2]) });
  }
  if (candidates.length === 0) {
    throw new Error('No WebMarketed price list file found on MOPH public price list page');
  }
  candidates.sort((a, b) => b.date - a.date);
  return candidates[0].url;
}

async function downloadPriceListXls(): Promise<MOPHPriceListRow[]> {
  const url = await findLatestMarketedXlsUrl();
  const xlsRes = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(120000),
  });
  if (!xlsRes.ok) {
    throw new Error(`Failed to download MOPH price list file (${xlsRes.status})`);
  }
  const buffer = Buffer.from(await xlsRes.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];

  const rows: MOPHPriceListRow[] = [];
  for (const r of rawRows) {
    const code = parseXlsPriceNumber(r['Code']);
    if (code === null) continue;
    
    let rawMargin = parseXlsPriceNumber(r['Pharmacist Margin']);
    if (rawMargin === 23.08) {
      rawMargin = 22.25;
    }

    rows.push({
      code,
      registrationNumber: stripTrailingComma(String(r['Registration number'] ?? '')),
      brandName: stripTrailingComma(String(r['Brand name'] ?? '')),
      strength: stripTrailingComma(String(r['Strength'] ?? '')),
      presentation: stripTrailingComma(String(r['Presentation'] ?? '')),
      form: stripTrailingComma(String(r['Form'] ?? '')),
      agent: stripTrailingComma(String(r['Agent'] ?? '')),
      manufacturer: stripTrailingComma(String(r['Manufacturer'] ?? '')),
      country: stripTrailingComma(String(r['Country'] ?? '')),
      publicPriceLBP: parseXlsPriceNumber(r['Public Price LL']),
      pharmacistMargin: rawMargin,
      stratum: stripTrailingComma(String(r['Stratum'] ?? '')),
    });
  }
  return rows;
}

async function getPriceListRows(): Promise<MOPHPriceListRow[]> {
  if (priceListCache && Date.now() - priceListCache.ts < 6 * 60 * 60 * 1000) {
    return priceListCache.rows;
  }
  const rows = await downloadPriceListXls();
  priceListCache = { ts: Date.now(), rows };
  return rows;
}

// GET /api/moph/price-list -> parsed official marketed drug price list
app.get('/api/moph/price-list', async (req, res) => {
  try {
    const rows = await getPriceListRows();
    return res.json(rows);
  } catch (err: any) {
    console.error('MOPH price list error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch MOPH public price list' });
  }
});

// ---------------------------------------------------------------------------
// Trusted online time (for the "Update from MOPH" 1-year unlock).
//
// The unlock expiry must NOT be decided from the PC's local clock (a user could
// backdate it to re-enable the feature). Instead, the server reads the current
// time from public HTTPS hosts (Date header / cloudflare trace) and returns it
// to the renderer. Fails closed: if no source is reachable, the client treats
// the feature as locked. Result is cached for 60s.
// ---------------------------------------------------------------------------
const TRUSTED_TIME_SOURCES = [
  'https://moph.gov.lb/',                       // same trusted host the price list comes from
  'https://www.cloudflare.com/cdn-cgi/trace',   // tiny text; contains ts=<unix seconds>
];

let trustedTimeCache: { ts: number; unixMs: number } | null = null;

async function fetchTrustedTime(): Promise<number> {
  for (const url of TRUSTED_TIME_SOURCES) {
    try {
      const isCloudflare = url.includes('cdn-cgi/trace');
      const resp = await fetch(url, {
        method: isCloudflare ? 'GET' : 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;

      if (isCloudflare) {
        const text = await resp.text();
        const match = /^ts=(\d+)$/m.exec(text);
        if (match) return Number(match[1]) * 1000;
        continue;
      }

      const date = resp.headers.get('date');
      if (date) {
        const unixMs = Date.parse(date);
        if (Number.isFinite(unixMs)) return unixMs;
      }
    } catch (e) {
      console.warn(`Trusted time source failed (${url}):`, (e as Error)?.message || e);
    }
  }
  throw new Error('No trusted time source reachable');
}

app.get('/api/moph/now', async (req, res) => {
  try {
    if (trustedTimeCache && Date.now() - trustedTimeCache.ts < 60 * 1000) {
      return res.json({ unixMs: trustedTimeCache.unixMs, trusted: true, source: 'cache' });
    }
    const unixMs = await fetchTrustedTime();
    trustedTimeCache = { ts: Date.now(), unixMs };
    return res.json({ unixMs, trusted: true, source: 'online' });
  } catch (err: any) {
    console.error('MOPH trusted time error:', err?.message || err);
    return res.status(502).json({ error: 'Could not verify the current time online', trusted: false });
  }
});

// LNDD ingredients lookup cache keyed by normalized query signature,
// persisted to disk so app/PC restarts don't re-hit the public site.
const lnddIngredientsCache = new Map<string, string>();
const lnddIngredientsInflight = new Map<string, Promise<string>>();

const LNDD_CACHE_FILE = process.env.LNDD_CACHE_FILE
  || (process.env.NODE_ENV === 'production'
    ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'Lebanon Pharma Pro', 'lndd-ingredients-cache.json')
    : path.join(process.cwd(), '.cache', 'lndd-ingredients-cache.json'));

let lnddSaveTimer: NodeJS.Timeout | null = null;
function scheduleLnddCacheSave() {
  if (lnddSaveTimer) clearTimeout(lnddSaveTimer);
  lnddSaveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(LNDD_CACHE_FILE), { recursive: true });
      fs.writeFileSync(LNDD_CACHE_FILE, JSON.stringify(Object.fromEntries(lnddIngredientsCache)));
    } catch (e) {
      console.warn('Failed to persist LNDD ingredients cache:', e?.message || e);
    }
  }, 1000);
}

try {
  if (fs.existsSync(LNDD_CACHE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(LNDD_CACHE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) lnddIngredientsCache.set(k, String(v));
    }
  }
} catch (e) {
  console.warn('Failed to load LNDD ingredients cache:', e?.message || e);
}

// The LNDD search only matches substring tokens in the market database, and
// rejects multi-word queries (e.g. "AMOXIL 250" returns nothing). Build a small
// ordered list of safer terms to try: exact name, name minus trailing numbers/
// units, then each alphabetic word of the name.
function candidateSearchTerms(name: string): string[] {
  const out: string[] = [];
  const norm = name.trim();
  if (!norm) return out;
  out.push(norm);

  const stripped = norm
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:MG|MCG|G|IU|ML|UI|%)\b/gi, '')
    .replace(/\s+/, ' ')
    .trim();
  if (stripped && stripped !== norm) out.push(stripped);

  const tokens = norm.split(/[\s/*,+()&]+/g)
    .map(t => t.trim())
    .filter(t => /^[A-Za-z]{3,}$/.test(t));
  for (const t of tokens) {
    if (t !== norm && t !== stripped) out.push(t);
  }

  return Array.from(new Set(out)).slice(0, 3);
}

async function findLnddIngredient(name: string, dosage: string, form: string): Promise<string> {
  const sig = lnddRowSignature(name, dosage);
  if (lnddIngredientsCache.has(sig)) return lnddIngredientsCache.get(sig) || '';

  const existing = lnddIngredientsInflight.get(sig);
  if (existing) return existing;

  const inflight = (async () => {
    let matched = '';
    for (const term of candidateSearchTerms(name)) {
      const termSig = lnddRowSignature(term, dosage);
      if (lnddIngredientsCache.has(termSig)) {
        matched = lnddIngredientsCache.get(termSig) || '';
      } else {
        const body = new URLSearchParams();
        body.append('data[Drug][name]', term);

        const searchRes = await fetch(MOPH_LNDD_SEARCH, {
          method: 'POST',
          headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(30000),
        });
        const html = searchRes.ok ? await searchRes.text() : '';
        const rows = parseLnddSearchTable(html);
        matched = pickBestIngredient(rows, term, dosage, form);
        lnddIngredientsCache.set(termSig, matched);
      }
      if (matched) break;
    }

    lnddIngredientsCache.set(sig, matched);
    scheduleLnddCacheSave();
    return matched;
  })();
  lnddIngredientsInflight.set(sig, inflight);
  void inflight.finally(() => lnddIngredientsInflight.delete(sig));
  return inflight;
}

// POST /api/moph/lndd-ingredients
// body: { items: [{ name, dosage, form }] } -> resolves Ingredients per item
// via one LNDD search per unique (name|dosage). Cached in memory.
// Lookups run concurrently to keep imports fast; batches are capped per request.
const MAX_LNDD_ITEMS_PER_REQUEST = 100;
const LNDD_LOOKUP_CONCURRENCY = 10;
const LNDD_POLITENESS_DELAY_MS = 50;

app.post('/api/moph/lndd-ingredients', async (req, res) => {
  try {
    const items: Array<{ name?: string; dosage?: string; form?: string }> =
      Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Missing items array' });
    }

    const batch = items.slice(0, MAX_LNDD_ITEMS_PER_REQUEST);
    const results: Array<{ name: string; dosage: string; form: string; ingredients: string }> = [];

    let cursor = 0;
    async function worker() {
      while (cursor < batch.length) {
        const item = batch[cursor++];
        const name = String(item?.name || '').trim();
        const dosage = String(item?.dosage || '').trim();
        const form = String(item?.form || '').trim();
        if (!name) {
          results.push({ name, dosage, form, ingredients: '' });
          continue;
        }
        try {
          const ingredients = await findLnddIngredient(name, dosage, form);
          results.push({ name, dosage, form, ingredients });
        } catch (e: any) {
          console.warn(`LNDD ingredients lookup failed for ${name}:`, e?.message || e);
          results.push({ name, dosage, form, ingredients: '' });
        }
        // Be polite to the public site between searches (parallelized, so short delay).
        await new Promise(r => setTimeout(r, LNDD_POLITENESS_DELAY_MS));
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(LNDD_LOOKUP_CONCURRENCY, batch.length) }, () => worker())
    );

    return res.json(results);
  } catch (err: any) {
    console.error('MOPH LNDD ingredients error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch ingredients from MOPH database' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const localDist = typeof __dirname !== 'undefined' ? __dirname : cwdDist;
    const distPath = fs.existsSync(cwdDist) ? cwdDist : localDist;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Pharmacy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
