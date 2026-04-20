/**
 * Bridge: factory transcript-tail SSE → vendored agent-flow visualizer.
 *
 * The factory now tails the Claude Code session JSONL (see
 * factory/src/factory/transcript_tail.py) and publishes
 * simulation-shape envelopes on /agent-flow/events?thread=<id>. Each
 * envelope already matches the webview's window.postMessage contract
 * (session-started, session-updated, session-ended, agent-event), so
 * this bridge is a thin pass-through — no per-event translation here.
 *
 * Scoping is by ``thread_id``: multiple browser windows can attach to
 * the same run, and switching to a fresh thread rebinds the SSE
 * connection transparently.
 */

'use client';

import { useEffect } from 'react';
import { useSessionReset } from './session-reset';

const FACTORY_URL =
  process.env.NEXT_PUBLIC_FACTORY_URL || 'http://localhost:8888';

function post(message: unknown): void {
  if (typeof window === 'undefined') return;
  window.postMessage(message, '*');
}

export function useAgentFlowBridge(): void {
  const { threadId } = useSessionReset();

  useEffect(() => {
    if (!threadId) return;

    // Reset any in-flight state on (re)connect — thread rotation is the
    // only way the stream changes, and the webview keeps per-session
    // buffers so this drops stale work cleanly.
    post({
      type: 'config',
      config: { showMockData: false, disable1MContext: false },
    });
    post({ type: 'reset', reason: 'thread-switch' });

    const url = `${FACTORY_URL.replace(/\/$/, '')}/agent-flow/events?thread=${encodeURIComponent(threadId)}`;
    const es = new EventSource(url);

    es.onopen = () => {
      post({ type: 'connection-status', status: 'connected', source: 'factory' });
    };

    es.onerror = () => {
      post({ type: 'connection-status', status: 'disconnected' });
    };

    es.onmessage = (evt) => {
      let envelope: unknown;
      try {
        envelope = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (envelope && typeof envelope === 'object' && 'type' in envelope) {
        post(envelope);
      }
    };

    return () => {
      es.close();
      post({ type: 'connection-status', status: 'disconnected' });
    };
  }, [threadId]);
}
