/**
 * Artifact → PDF export.
 *
 * Opens a clean, print-optimised window with the artifact rendered in
 * document-style HTML and triggers the browser's print dialog, where the
 * user can choose "Save as PDF". No extra dependency — the browser's
 * built-in PDF engine does the rest.
 */

import type { LeanCanvas } from '../hooks/ag-ui/types';
import type { BuildPlan, MarketAnalysis, StrategyBoard } from '../components/artifacts/shared';
import { parseMarkdown } from '../components/artifacts/shared';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function list(items: string[]): string {
  if (items.length === 0) return '';
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function section(label: string, body: string): string {
  return `<section><h2>${escapeHtml(label)}</h2>${body}</section>`;
}

export function strategyToPdfHtml(data: StrategyBoard): string {
  const vp = data.value_proposition;
  const ta = data.target_audience;
  const fl = data.feature_list;
  const parts: string[] = [];

  parts.push(
    section(
      'Value Proposition',
      `<p class="lead">${escapeHtml(vp.headline)}</p>` +
        (vp.differentiator ? `<p>${escapeHtml(vp.differentiator)}</p>` : '') +
        (vp.metric ? `<p class="metric">↗ ${escapeHtml(vp.metric)}</p>` : ''),
    ),
  );
  parts.push(
    section(
      `Target Audience · ${escapeHtml(ta.primary)}`,
      (ta.segments.length ? `<p><strong>Segments:</strong> ${ta.segments.map(escapeHtml).join(', ')}</p>` : '') +
        (ta.pain_points.length ? `<p><strong>Pain points:</strong></p>${list(ta.pain_points)}` : ''),
    ),
  );
  if (fl.must_have.length) parts.push(section('Must-Have', list(fl.must_have)));
  if (fl.should_have.length) parts.push(section('Should-Have', list(fl.should_have)));
  if (fl.out_of_scope.length) parts.push(section('Out of Scope', list(fl.out_of_scope)));
  return parts.join('');
}

export function marketToPdfHtml(data: MarketAnalysis): string {
  const inline = (text: string): string =>
    escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const body = parseMarkdown(data.analysis)
    .map((block) => {
      if (block.kind === 'heading') return `<h2>${escapeHtml(block.text)}</h2>`;
      if (block.kind === 'bullets') {
        return `<ul>${block.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(block.text)}</p>`;
    })
    .join('');
  return `<section>${body}</section>`;
}

export function planToPdfHtml(data: BuildPlan): string {
  const header =
    `<section><p class="lead">${escapeHtml(data.summary)}</p>` +
    (data.tech_stack ? `<p><strong>Stack:</strong> ${escapeHtml(data.tech_stack)}</p>` : '') +
    `</section>`;
  const steps = data.steps
    .map(
      (step, i) =>
        `<section class="step"><h3>${i + 1}. ${escapeHtml(step.title)}</h3>` +
        (step.description ? `<p>${escapeHtml(step.description)}</p>` : '') +
        (step.tool_hints.length
          ? `<p class="meta"><strong>Tools:</strong> ${step.tool_hints.map(escapeHtml).join(', ')}</p>`
          : '') +
        (step.outputs.length
          ? `<p class="meta"><strong>Outputs:</strong> ${step.outputs.map(escapeHtml).join(', ')}</p>`
          : '') +
        `</section>`,
    )
    .join('');
  return header + `<section><h2>Build Steps</h2>${steps}</section>`;
}

const CANVAS_BLOCKS: ReadonlyArray<{ key: keyof LeanCanvas; label: string }> = [
  { key: 'problem', label: 'Problem' },
  { key: 'customer_segments', label: 'Customer Segments' },
  { key: 'unique_value_proposition', label: 'Unique Value Proposition' },
  { key: 'solution', label: 'Solution' },
  { key: 'channels', label: 'Channels' },
  { key: 'revenue_streams', label: 'Revenue Streams' },
  { key: 'cost_structure', label: 'Cost Structure' },
  { key: 'key_metrics', label: 'Key Metrics' },
  { key: 'unfair_advantage', label: 'Unfair Advantage' },
];

export function canvasToPdfHtml(canvas: LeanCanvas): string {
  return CANVAS_BLOCKS.map(({ key, label }) => {
    const block = canvas[key];
    if (!block || typeof block === 'string') return '';
    const headline = block.headline ? `<p class="lead">${escapeHtml(block.headline)}</p>` : '';
    const bullets = block.bullets?.length ? list(block.bullets) : '';
    if (!headline && !bullets) return '';
    return section(label, headline + bullets);
  })
    .filter(Boolean)
    .join('');
}

const PRINT_STYLES = `
  @page { margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  html, body {
    font-family: "EB Garamond", Garamond, Georgia, "Times New Roman", serif;
    color: #1a1a1a;
    background: #ffffff;
    line-height: 1.45;
    margin: 0;
    padding: 0;
  }
  body {
    padding: 28px 32px;
    max-width: 780px;
    margin: 0 auto;
  }
  header.doc-head {
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 10px;
    margin-bottom: 22px;
  }
  header.doc-head h1 {
    margin: 0;
    font-size: 26px;
    letter-spacing: 0.02em;
  }
  header.doc-head .meta {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #666;
    margin-top: 6px;
  }
  section { margin-bottom: 18px; break-inside: avoid; }
  section.step { margin-bottom: 12px; }
  h2 {
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #444;
    border-bottom: 1px solid #c9b987;
    padding-bottom: 4px;
    margin: 0 0 8px 0;
  }
  h3 { font-size: 15px; margin: 0 0 4px 0; }
  p { margin: 0 0 6px 0; font-size: 13px; }
  p.lead { font-size: 15px; font-weight: 600; }
  p.metric { font-style: italic; color: #7a5a1a; }
  p.meta { font-size: 12px; color: #555; }
  ul { margin: 4px 0 8px 20px; padding: 0; }
  li { font-size: 13px; margin-bottom: 2px; }
  pre.prose {
    white-space: pre-wrap;
    font-family: inherit;
    font-size: 13px;
    margin: 0;
  }
  footer.doc-foot {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #c9b987;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #888;
    text-align: center;
  }
  @media screen {
    body { background: #f7f3ea; min-height: 100vh; }
    .print-hint {
      position: fixed; top: 12px; right: 12px;
      background: #1a1a1a; color: #fff; padding: 8px 14px;
      font-family: system-ui, sans-serif; font-size: 12px;
      border-radius: 4px; opacity: 0.85;
    }
  }
  @media print { .print-hint { display: none; } }
`;

export function savePdf(title: string, bodyHtml: string): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=960,height=1200');
  if (!w) {
    console.warn('Unable to open print window — check popup blocker.');
    return;
  }
  const safeTitle = escapeHtml(title);
  const stamp = new Date().toLocaleString();
  w.document.open();
  w.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="print-hint">Use your browser's print dialog → Save as PDF</div>
  <header class="doc-head">
    <h1>${safeTitle}</h1>
    <div class="meta">Startup in a Box · ${escapeHtml(stamp)}</div>
  </header>
  ${bodyHtml}
  <footer class="doc-foot">Generated by Startup in a Box</footer>
</body>
</html>`);
  w.document.close();
  w.focus();
  // Let layout settle before the print dialog fires.
  w.onload = () => {
    try {
      w.print();
    } catch {
      // Swallow — user can still invoke print manually.
    }
  };
}
