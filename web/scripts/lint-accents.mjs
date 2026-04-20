#!/usr/bin/env node
// Spanish accent linter for rioplatense speaker notes.
// Scans src/slides/*.tsx for common unaccented words inside `notes:` strings
// and flags them. Exit 1 on any violation so CI can gate.
//
// The rule is conservative: only flag words where the unaccented form is
// (a) rarely used standalone and (b) usually a mistake in rioplatense voseo.
// Context-dependent pairs (mas/más, aun/aún, si/sí, que/qué, como/cómo,
// donde/dónde, cuando/cuándo) are NOT flagged — too many false positives.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLIDES_DIR = resolve(HERE, '..', 'src', 'slides');

// { bad: good }. Conservative list — only unambiguous mistakes.
const RULES = {
  compresion: 'compresión',
  semantica: 'semántica',
  razon: 'razón',
  unica: 'única',
  demas: 'demás',
  aca: 'acá',
  libreria: 'librería',
  codigo: 'código',
  tambien: 'también',
  aqui: 'aquí',
  rapido: 'rápido',
  util: 'útil',
  facil: 'fácil',
  dificil: 'difícil',
  mecanico: 'mecánico',
  critico: 'crítico',
  practico: 'práctico',
  sincronico: 'sincrónico',
  dinamico: 'dinámico',
  ademas: 'además',
  automatico: 'automático',
  sintactico: 'sintáctico',
  logica: 'lógica',
  tecnica: 'técnica',
  publico: 'público',
  ultima: 'última',
  ultimo: 'último',
  rapidamente: 'rápidamente',
  facilmente: 'fácilmente',
};

// Extract note strings from TSX. Notes live in `notes: \`…\``.
function extractNotes(src) {
  const out = [];
  const re = /notes:\s*`([^`]*)`/gs;
  let m;
  while ((m = re.exec(src))) out.push({ start: m.index, text: m[1] });
  return out;
}

function lint(text, file, offset) {
  const violations = [];
  for (const [bad, good] of Object.entries(RULES)) {
    // word boundary — allow -/_ as non-boundary so e.g. "razon_fuerte" still matches
    const re = new RegExp(`\\b${bad}\\b`, 'gi');
    let m;
    while ((m = re.exec(text))) {
      // compute 1-based line/col relative to file start (offset + m.index)
      violations.push({ file, bad, good, index: offset + m.index, excerpt: text.slice(Math.max(0, m.index - 24), m.index + bad.length + 24) });
    }
  }
  return violations;
}

async function main() {
  const entries = (await readdir(SLIDES_DIR)).filter((f) => f.endsWith('.tsx'));
  let total = 0;
  for (const name of entries.sort()) {
    const full = join(SLIDES_DIR, name);
    const src = await readFile(full, 'utf8');
    const notes = extractNotes(src);
    for (const n of notes) {
      const viol = lint(n.text, name, n.start);
      for (const v of viol) {
        total += 1;
        const lineNo = src.slice(0, v.index).split('\n').length;
        console.log(`${v.file}:${lineNo}  ${v.bad} → ${v.good}   …${v.excerpt.replace(/\n/g, ' ')}…`);
      }
    }
  }
  if (total === 0) {
    console.log('accents ok · 0 violations');
    process.exit(0);
  } else {
    console.error(`\n${total} violation(s). Fix before shipping.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
