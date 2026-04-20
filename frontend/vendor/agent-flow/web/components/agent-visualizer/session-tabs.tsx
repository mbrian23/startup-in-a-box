'use client'

// Stripped: upstream session-tabs UI removed in vendored copy.
// We run a single factory session per page load, so the tab row is
// hidden. Kept as a stub so top-bar.tsx imports unchanged.

import type { SessionInfo } from '@/lib/vscode-bridge'

interface SessionTabsProps {
  sessions: SessionInfo[]
  selectedSessionId: string | null
  sessionsWithActivity: Set<string>
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
}

export function SessionTabs(_: SessionTabsProps) {
  return null
}
