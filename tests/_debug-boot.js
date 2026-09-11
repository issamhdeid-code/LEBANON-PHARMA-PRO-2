import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3456;
const HOST = '127.0.0.1';
const BASE = `http://localhost:${PORT}`;
const CHROME = [
  process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env.PROGRAMFILES + '\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => p && fs.existsSync(p));

const SECRET = crypto.randomBytes(24).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bootServer() {
  const secretFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pharma-secret-')), 'sync-secret.json');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/server.cjs'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), HOST, NODE_ENV: 'production', SYNC_SECRET_FILE: secretFile, GOOGLE_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let out = '';
    const deadline = Date.now() + 40000;
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes(`http://${HOST}:${PORT}`)) resolve(child);
    });
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', (c) => c && c !== 0 && reject(new Error('exit ' + c)));
    const t = setInterval(() => Date.now() > deadline && (clearInterval(t), reject(new Error('timeout'))), 1000);
  });
}

const server = await bootServer();
const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1500, height: 950 },
  args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.createBrowserContext();
const page = await context.newPage();
const events = [];
page.on('console', (m) => events.push({ k: m.type(), t: m.text().slice(0, 400) }));
page.on('pageerror', (e) => events.push({ k: 'pageerror', t: String(e).slice(0, 400) }));
page.on('requestfailed', (r) => events.push({ k: 'requestfailed', t: `${r.url().slice(0, 120)} :: ${r.failure() && r.failure().errorText}` }));
await page.evaluateOnNewDocument((s) => {
  try { localStorage.setItem('pharmalebanon_sync_secret_v1', s); } catch (e) {}
}, SECRET);

const responses = [];
page.on('response', (r) => { if (r.status() >= 400) responses.push(`${r.status()} ${r.url()}`); });

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('goto err', e.message));
await sleep(12000);
const dbg = await page.evaluate(() => ({
  title: document.title,
  bodyLen: document.body ? document.body.innerText.length : -1,
  bodyHead: document.body ? document.body.innerText.slice(0, 800) : '',
  rootChilds: document.getElementById('root') ? document.getElementById('root').children.length : -1,
  hasInit: typeof window.__PT !== 'undefined',
  hasDate: typeof window.Date,
}));
console.log('TITLE:', dbg.title);
console.log('BODY LEN:', dbg.bodyLen, 'ROOT CHILDREN:', dbg.rootChilds, '__PT:', dbg.hasInit, 'Date:', dbg.hasDate);
console.log('BODY HEAD:', JSON.stringify(dbg.bodyHead));
console.log('HTTP >=400:', responses);
console.log('EVENTS:');
for (const e of events) console.log(' -', e.k, '::', e.t);
await browser.close();
server.kill();