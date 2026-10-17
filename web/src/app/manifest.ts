import type { MetadataRoute } from "next";

/** "Add to Home screen" opens Nimbus like an app, with its own icon and name. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nimbus",
    short_name: "Nimbus",
    description: "Opportunities, the moment they form.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0E13",
    theme_color: "#0B0E13",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
