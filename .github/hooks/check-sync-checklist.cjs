#!/usr/bin/env node
// Deterministic check for the "wiring a new synced entity" checklist described in
// .github/skills/two-pc-sync/SKILL.md. Runs after every tool call; it's a couple of
// fast regex passes over two files, so this is safe to run unconditionally.
//
// It checks that every SyncPayload type is: declared in syncEngine.ts, actually
// broadcast somewhere, AND actually handled in PharmacyContext.tsx's onMessage switch.
// It does NOT check snapshot-payload key parity (too structure-fragile for a regex
// check) — that part of the checklist still needs manual review.
//
// package.json has "type": "module", so this script must stay CommonJS ".cjs".

const fs = require('fs');
const path = require('path');

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function main() {
  const root = process.cwd();
  const contextPath = path.join(root, 'src', 'context', 'PharmacyContext.tsx');
  const enginePath = path.join(root, 'src', 'services', 'syncEngine.ts');

  const contextSrc = readIfExists(contextPath);
  const engineSrc = readIfExists(enginePath);

  if (!contextSrc || !engineSrc) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  // 1. Types declared in the SyncPayload union
  const typeBlockMatch = engineSrc.match(/type SyncPayload = \{([\s\S]*?)\};/);
  const declaredTypes = new Set();
  if (typeBlockMatch) {
    for (const q of typeBlockMatch[1].matchAll(/'([A-Z_]+)'/g)) declaredTypes.add(q[1]);
  }

  // 2. Types actually broadcast
  const broadcastTypes = new Set();
  for (const m of contextSrc.matchAll(/syncEngine\.broadcast\(\s*'([A-Z_]+)'/g)) broadcastTypes.add(m[1]);

  // 3. Types actually handled on receipt
  const handledTypes = new Set();
  for (const m of contextSrc.matchAll(/payload\.type === '([A-Z_]+)'/g)) handledTypes.add(m[1]);

  const warnings = [];
  for (const t of broadcastTypes) {
    if (!declaredTypes.has(t)) {
      warnings.push(`'${t}' is broadcast in PharmacyContext.tsx but missing from SyncPayload['type'] in syncEngine.ts`);
    }
    if (!handledTypes.has(t)) {
      warnings.push(`'${t}' is broadcast but has no "payload.type === '${t}'" branch in the onMessage handler`);
    }
  }
  for (const t of declaredTypes) {
    if (!broadcastTypes.has(t)) {
      warnings.push(`'${t}' is declared in SyncPayload but never broadcast anywhere (dead type, or a broadcast call is missing)`);
    }
  }

  if (warnings.length > 0) {
    process.stdout.write(JSON.stringify({
      systemMessage:
        'two-pc-sync checklist drift detected:\n- ' + warnings.join('\n- ') +
        '\nSnapshot-payload key parity (getLocalSnapshot / onSnapshotRequested / snapshotData) still needs manual review — see .github/skills/two-pc-sync/SKILL.md.'
    }));
  } else {
    process.stdout.write(JSON.stringify({}));
  }
}

try {
  main();
} catch (e) {
  // Never break the agent session over a broken lint script.
  process.stdout.write(JSON.stringify({}));
}
