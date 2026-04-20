#!/usr/bin/env node
// Regenerate public/snapshot.json from real repo files so the deck's
// CodeView works fully offline. Run: npm run snapshot.

import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '..');

const TARGETS = [
  { path: '.claude/settings.json', lang: 'json' },
  { path: '.claude/skills/dev-auto-loop/SKILL.md', lang: 'markdown' },
  { path: '.claude/skills/interpret-logs/SKILL.md', lang: 'markdown' },
  { path: 'orchestrator/adk_apps/ceo/agent.py', lang: 'python' },
  { path: 'orchestrator/adk_apps/cto/agent.py', lang: 'python' },
  { path: 'orchestrator/adk_apps/business_planner/agent.py', lang: 'python' },
  { path: 'orchestrator/adk_apps/brand_designer/agent.py', lang: 'python' },
  { path: 'orchestrator/src/orchestrator/server.py', lang: 'python' },
  { path: 'factory/src/factory/subagents.py', lang: 'python' },
  { path: 'factory/src/factory/runner.py', lang: 'python' },
  { path: 'factory/src/factory/quality_hooks.py', lang: 'python' },
  { path: 'frontend/src/hooks/useAgUiEvents.ts', lang: 'typescript' },
];

async function tryRead(rel) {
  const abs = join(REPO, rel);
  try {
    const s = await stat(abs);
    if (!s.isFile()) return null;
    return await readFile(abs, 'utf8');
  } catch {
    return null;
  }
}

const files = [];
for (const t of TARGETS) {
  const content = await tryRead(t.path);
  if (content == null) {
    console.warn(`skip: ${t.path} (not found)`);
    continue;
  }
  files.push({
    path: t.path,
    language: t.lang,
    content,
    bytes: Buffer.byteLength(content, 'utf8'),
  });
}

const snapshot = { generatedAt: new Date().toISOString(), files };
const out = join(WEB, 'public', 'snapshot.json');
await writeFile(out, JSON.stringify(snapshot, null, 2));
console.log(`snapshot: ${files.length} files, ${Buffer.byteLength(JSON.stringify(snapshot))} bytes → ${out}`);
