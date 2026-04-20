"use client";

import dynamic from "next/dynamic";

// CopilotKit + PixiJS require browser APIs — skip SSR entirely
const ClientApp = dynamic(() => import("../components/ClientApp"), {
  ssr: false,
});

export default function Home() {
  return <ClientApp />;
}
