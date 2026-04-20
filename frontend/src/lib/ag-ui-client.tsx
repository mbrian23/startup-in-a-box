"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSessionReset } from "./session-reset";
import type { AgUiEvent, AgUiEventSource } from "../hooks/ag-ui/types";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "/api/orchestrator";

// ---------------------------------------------------------------------------
// SSE stream reader — pure async iteration, no React
// ---------------------------------------------------------------------------

async function* readSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const json = trimmed.slice(6);
        if (json === "[DONE]") continue;
        try { yield JSON.parse(json); } catch { /* malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Raw SSE → typed AgUiEvent mapper
// ---------------------------------------------------------------------------

function mapRawToEvent(
  raw: Record<string, unknown>,
  agentNameRef: { current: string | undefined },
): AgUiEvent | null {
  const type = raw.type as string;
  const mid = (raw.messageId ?? raw.message_id) as string | undefined;
  const agent = (raw.agentName ?? raw.name ?? agentNameRef.current) as string | undefined;

  switch (type) {
    case "RUN_STARTED":
      agentNameRef.current = undefined;
      return { type: "RUN_STARTED" };

    case "TEXT_MESSAGE_START":
      agentNameRef.current = agent;
      return { type: "TEXT_MESSAGE_START", messageId: mid, name: agent };

    case "TEXT_MESSAGE_CONTENT":
      return {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: mid,
        content: (raw.delta ?? raw.content ?? "") as string,
        agentId: agent,
        name: agent,
      };

    case "TEXT_MESSAGE_END":
      return { type: "TEXT_MESSAGE_END", messageId: mid, agentId: agent };

    case "TOOL_CALL_START":
      return {
        type: "TOOL_CALL_START",
        toolCallId: (raw.toolCallId ?? raw.tool_call_id) as string | undefined,
        toolName: (raw.toolCallName ?? raw.name ?? "") as string,
        agentId: agent,
      };

    case "TOOL_CALL_END":
      return {
        type: "TOOL_CALL_END",
        toolCallId: (raw.toolCallId ?? raw.tool_call_id) as string | undefined,
        agentId: agent,
      };

    case "STATE_DELTA":
      return Array.isArray(raw.delta) ? { type: "STATE_DELTA", delta: raw.delta } : null;

    case "STATE_SNAPSHOT":
      return raw.snapshot && typeof raw.snapshot === "object"
        ? { type: "STATE_SNAPSHOT", snapshot: raw.snapshot as Record<string, unknown> }
        : null;

    case "RUN_FINISHED":
      return { type: "RUN_FINISHED" };

    case "RUN_ERROR":
      return { type: "RUN_ERROR", error: (raw.message ?? raw.error ?? "Unknown error") as string };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// React context + provider
// ---------------------------------------------------------------------------

interface AgUiClientValue {
  launch: (idea: string) => void;
  abortRun: () => void;
  eventSource: AgUiEventSource;
  threadId: string;
  isStreaming: boolean;
}

const AgUiClientContext = createContext<AgUiClientValue | null>(null);

export function AgUiClientProvider({ children }: { children: ReactNode }) {
  const { threadId } = useSessionReset();
  const handlersRef = useRef(new Set<(event: AgUiEvent) => void>());
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const eventSource = useMemo<AgUiEventSource>(
    () => ({
      subscribe: (handler) => {
        handlersRef.current.add(handler);
        return () => { handlersRef.current.delete(handler); };
      },
    }),
    [],
  );

  const emit = useCallback((event: AgUiEvent) => {
    for (const handler of handlersRef.current) {
      try { handler(event); } catch { /* */ }
    }
  }, []);

  const logEvent = useCallback((event: AgUiEvent) => {
    void fetch("/api/ag-ui-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, event }),
      keepalive: true,
    }).catch(() => {});
  }, [threadId]);

  const abortRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, [threadId]);

  const launch = useCallback(
    (idea: string) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setIsStreaming(true);

      const body = {
        thread_id: threadId,
        run_id: crypto.randomUUID(),
        state: {},
        messages: [{ id: crypto.randomUUID(), role: "user", content: idea }],
      };

      const agentNameRef = { current: undefined as string | undefined };

      (async () => {
        try {
          const res = await fetch(ORCHESTRATOR_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: ac.signal,
          });

          if (!res.ok || !res.body) {
            const err: AgUiEvent = { type: "RUN_ERROR", error: `HTTP ${res.status}` };
            emit(err);
            logEvent(err);
            return;
          }

          for await (const raw of readSseStream(res.body)) {
            const event = mapRawToEvent(raw, agentNameRef);
            if (event) {
              emit(event);
              logEvent(event);
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const event: AgUiEvent = {
            type: "RUN_ERROR",
            error: err instanceof Error ? err.message : "Unknown error",
          };
          emit(event);
          logEvent(event);
        } finally {
          setIsStreaming(false);
        }
      })();
    },
    [threadId, emit, logEvent],
  );

  const value = useMemo<AgUiClientValue>(
    () => ({ launch, abortRun, eventSource, threadId, isStreaming }),
    [launch, abortRun, eventSource, threadId, isStreaming],
  );

  return (
    <AgUiClientContext.Provider value={value}>
      {children}
    </AgUiClientContext.Provider>
  );
}

export function useAgUiClient(): AgUiClientValue {
  const ctx = useContext(AgUiClientContext);
  if (!ctx) throw new Error("useAgUiClient must be used within AgUiClientProvider");
  return ctx;
}
