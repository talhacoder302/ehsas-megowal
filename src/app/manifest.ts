import type { MetadataRoute } from "next";

// Installable app ("Add to home screen"). Opening it lands on /login, which
// sends a signed-in user straight to their own area.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ehsas Program",
    short_name: "Ehsas",
    description: "Ehsas Program Megowal: village welfare fund",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f6b4f",
    categories: ["finance", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
