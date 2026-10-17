import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

// Serves the service worker at /serwist/sw.js (built from src/sw.ts at build time).
// The offline page is precached so it shows when a page cannot load.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/sw.ts",
  // esbuild ships with the dev tools; esbuild-wasm is not installed.
  useNativeEsbuild: true,
  // Only styles up front (a few KB): the offline page and the saved lists are
  // server-rendered and readable without JavaScript, and scripts are cached as
  // each screen is used. Precaching every chunk would cost ~3 MB of mobile data.
  globPatterns: [".next/static/**/*.css"],
  additionalPrecacheEntries: [{ url: "/~offline", revision: randomUUID() }],
});
