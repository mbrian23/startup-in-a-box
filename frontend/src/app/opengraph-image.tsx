import { ImageResponse } from "next/og";

export const alt = "Startup in a Box — autonomous agent swarm that builds startups";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #0B1220 0%, #13203A 100%)",
          color: "#F8FAFC",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, letterSpacing: 3, color: "#F5B841" }}>
          OPEN-SOURCE · MULTI-AGENT DEMO
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>Startup in a Box</div>
          <div style={{ fontSize: 34, color: "#C7D2E5", marginTop: 20, maxWidth: 900 }}>
            A boardroom of AI agents plans a startup while a factory builds and deploys it — live.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#F5B841", fontFamily: "monospace" }}>
          startupinabox.martinbrian.com
        </div>
      </div>
    ),
    size,
  );
}
