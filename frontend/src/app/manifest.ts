import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Startup in a Box",
    short_name: "Startup in a Box",
    description:
      "A boardroom of AI agents plans a startup while a factory builds and deploys it — live.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B1220",
    theme_color: "#0B1220",
    icons: [{ src: "/favicon.ico", sizes: "any" }],
  };
}
