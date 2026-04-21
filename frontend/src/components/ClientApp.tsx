"use client";

import { useState } from "react";
import { DemoApp } from "./DemoApp";
import { TooltipNotes } from "./TooltipNotes";
import { SceneProvider } from "../lib/scene-provider";
import { ThemeProvider } from "../lib/theme-provider";

export default function ClientApp() {
  const [mode] = useState(() => {
    if (typeof window === 'undefined') return 'demo';
    const params = new URLSearchParams(window.location.search);
    if (params.has('notes')) return 'notes';
    return 'demo';
  });

  if (mode === 'notes') {
    return (
      <ThemeProvider>
        <TooltipNotes />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SceneProvider>
        <DemoApp />
      </SceneProvider>
    </ThemeProvider>
  );
}
