"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "./App";
import { DemoApp } from "./DemoApp";
import { TooltipNotes } from "./TooltipNotes";
import { SceneProvider } from "../lib/scene-provider";
import { SessionResetProvider } from "../lib/session-reset";
import { ThemeProvider } from "../lib/theme-provider";
import { AgUiClientProvider } from "../lib/ag-ui-client";
import { UnicornTransition } from "./UnicornTransition";

const CURTAIN_IN_MS = 520;
const HOLD_MS = 480;
const CURTAIN_OUT_MS = 520;

function cancelOthers(keep: string): void {
  void fetch("/api/cancel-others", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keep }),
    keepalive: true,
  }).catch(() => {});
}

function LiveApp() {
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [curtain, setCurtain] = useState(false);
  const inflight = useRef(false);

  useEffect(() => { cancelOthers(threadId); }, [threadId]);

  const reset = useCallback(() => {
    if (inflight.current) return;
    inflight.current = true;
    setCurtain(true);
    setThreadId(crypto.randomUUID());
    window.setTimeout(() => setCurtain(false), CURTAIN_IN_MS + HOLD_MS);
    window.setTimeout(() => {
      inflight.current = false;
    }, CURTAIN_IN_MS + HOLD_MS + CURTAIN_OUT_MS);
  }, []);

  return (
    <ThemeProvider>
      <SceneProvider>
        <SessionResetProvider reset={reset} threadId={threadId}>
          <AgUiClientProvider>
            <App />
            <UnicornTransition active={curtain} />
          </AgUiClientProvider>
        </SessionResetProvider>
      </SceneProvider>
    </ThemeProvider>
  );
}

export default function ClientApp() {
  const [mode] = useState(() => {
    if (typeof window === 'undefined') return 'live';
    const params = new URLSearchParams(window.location.search);
    if (params.has('notes')) return 'notes';
    if (params.has('demo')) return 'demo';
    return 'live';
  });

  if (mode === 'notes') {
    return (
      <ThemeProvider>
        <TooltipNotes />
      </ThemeProvider>
    );
  }

  if (mode === 'demo') {
    return (
      <ThemeProvider>
        <SceneProvider>
          <DemoApp />
        </SceneProvider>
      </ThemeProvider>
    );
  }

  return <LiveApp />;
}
