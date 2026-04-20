'use client';

/**
 * OverridesPanel — fixed HTML panel listing everything the debug
 * overlay has changed at runtime (character positions, rotations, and
 * blocked-tile toggles).
 *
 * Actions:
 *   - **Commit**: POST the current position + rotation overrides to
 *     `/api/boardroom-stations`, which writes them into the canonical
 *     `boardroom-stations.json`. Fast Refresh then picks up the new
 *     source positions and the overlay overrides clear on success.
 *     Blocked-tile toggles still need a manual paste into the ASCII
 *     map — they don't live in the stations JSON.
 *   - **Copy snippet**: copy the same override data as a code snippet
 *     in case the author prefers pasting into source by hand.
 *   - **Reset**: clear all runtime overrides without committing.
 *
 * Only renders when at least one override exists.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  clearAllOverrides,
  getPaintMode,
  setPaintMode,
  snapshotOverrides,
  useOverridesVersion,
  type PaintMode,
} from '../pixi/debug/position-overrides';

type CommitStatus = 'idle' | 'saving' | 'saved' | 'error';

export function OverridesPanel() {
  useOverridesVersion(); // subscribe so the panel re-renders on changes
  const { positions, rotations, blockedToggle } = snapshotOverrides();
  const paintMode = getPaintMode();
  const [status, setStatus] = useState<CommitStatus>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const snippet = useMemo(() => {
    const parts: string[] = [];
    if (positions.size > 0) {
      parts.push('// positions:');
      for (const [id, pos] of positions) {
        parts.push(`  "${id}": { "x": ${pos.x}, "y": ${pos.y} },`);
      }
    }
    if (rotations.size > 0) {
      parts.push('// rotations:');
      for (const [id, dir] of rotations) {
        parts.push(`  "${id}": "${dir}",`);
      }
    }
    if (blockedToggle.size > 0) {
      parts.push('// blocked-tile toggles (paste into boardroom-collision.ts):');
      parts.push(`  ${Array.from(blockedToggle).map((k) => `"${k}"`).join(', ')}`);
    }
    return parts.join('\n');
  }, [positions, rotations, blockedToggle]);

  const anyChange =
    positions.size > 0 || rotations.size > 0 || blockedToggle.size > 0;
  const totalChanges = positions.size + rotations.size + blockedToggle.size;

  const copy = useCallback(() => {
    if (!snippet) return;
    void navigator.clipboard?.writeText(snippet);
  }, [snippet]);

  const commit = useCallback(async () => {
    if (!anyChange) return;
    setStatus('saving');
    setErrMsg(null);
    try {
      const body = {
        positions: Object.fromEntries(positions),
        rotations: Object.fromEntries(rotations),
        blockedToggle: Array.from(blockedToggle),
      };
      const res = await fetch('/api/boardroom-stations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setStatus('saved');
      // Clear committed overrides — once Fast Refresh reloads the JSON
      // these edits are canonical, so the runtime override layer is
      // no longer needed.
      clearAllOverrides();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, [positions, rotations, blockedToggle, anyChange]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 76,
        zIndex: 20,
        width: 300,
        padding: '10px 12px',
        background: 'rgba(10, 15, 31, 0.95)',
        color: '#e0e0f0',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
        borderRadius: 8,
        border: '1px solid rgba(136, 204, 255, 0.35)',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          color: '#ffe14a',
          fontWeight: 700,
          letterSpacing: '0.06em',
        }}
      >
        <span>OVERRIDES ({totalChanges})</span>
        <span style={{ color: '#8895a8', fontSize: 10, fontWeight: 500 }}>
          pos {positions.size} · rot {rotations.size} · tile {blockedToggle.size}
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '6px 8px',
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: 4,
          color: '#cfe4ff',
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflow: 'auto',
          minHeight: 28,
        }}
      >
        {snippet || '// no overrides yet — move or rotate a character,\n// or click a tile to toggle blocked.'}
      </pre>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          type="button"
          onClick={commit}
          disabled={!anyChange || status === 'saving'}
          title={
            anyChange
              ? 'Write positions, rotations, and blocked-tile overrides into boardroom-stations.json'
              : 'No pending changes to commit'
          }
          style={{
            flex: 1,
            padding: '5px 8px',
            background: anyChange ? '#1e6b3a' : 'rgba(60, 60, 60, 0.5)',
            color: '#fff',
            border: '1px solid rgba(120, 220, 150, 0.5)',
            borderRadius: 4,
            cursor: anyChange ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            fontSize: 11,
            opacity: status === 'saving' ? 0.6 : 1,
          }}
        >
          {status === 'saving' ? 'Committing…' : status === 'saved' ? 'Committed ✓' : 'Commit to JSON'}
        </button>
        <button
          type="button"
          onClick={copy}
          style={{
            padding: '5px 8px',
            background: '#1a3a7a',
            color: '#fff',
            border: '1px solid rgba(136, 204, 255, 0.5)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={clearAllOverrides}
          style={{
            padding: '5px 8px',
            background: 'rgba(232, 60, 60, 0.35)',
            color: '#fff',
            border: '1px solid rgba(232, 60, 60, 0.6)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
        >
          Reset
        </button>
      </div>
      {status === 'error' && errMsg && (
        <div style={{ marginTop: 6, color: '#ff8080', fontSize: 10 }}>
          Commit failed: {errMsg}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ color: '#ffe14a', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
          WALKABILITY TOOL
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PaintButton mode="off" active={paintMode} label="Off" />
          <PaintButton mode="block" active={paintMode} label="Block" />
          <PaintButton mode="free" active={paintMode} label="Free" />
          <PaintButton mode="toggle" active={paintMode} label="Toggle" />
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: '#8895a8',
          lineHeight: 1.4,
        }}
      >
        <div><b>G</b> toggles overlay. Click dot → click tile to move. ↑ ↓ ← → rotates.</div>
        <div>Pick Block / Free / Toggle, then click tiles to edit walkability.</div>
      </div>
    </div>
  );
}

function PaintButton({
  mode,
  active,
  label,
}: {
  mode: PaintMode;
  active: PaintMode;
  label: string;
}) {
  const isOn = active === mode;
  const bg =
    mode === 'block'
      ? isOn ? '#a03030' : 'rgba(160, 48, 48, 0.3)'
      : mode === 'free'
        ? isOn ? '#1e6b3a' : 'rgba(30, 107, 58, 0.3)'
        : mode === 'toggle'
          ? isOn ? '#6b5b1e' : 'rgba(107, 91, 30, 0.3)'
          : isOn ? '#333' : 'rgba(60, 60, 60, 0.3)';
  return (
    <button
      type="button"
      onClick={() => setPaintMode(mode)}
      style={{
        flex: 1,
        padding: '4px 6px',
        background: bg,
        color: '#fff',
        border: `1px solid ${isOn ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: isOn ? 700 : 400,
      }}
    >
      {label}
    </button>
  );
}
