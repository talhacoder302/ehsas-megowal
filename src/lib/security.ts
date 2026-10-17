// Content Security Policy for every page (sent by src/proxy.ts with a fresh
// nonce per request). Pure, so it can be tested.

export type CspOptions = {
  /** Random per request; Next.js puts it on its own inline scripts. */
  nonce: string;
  /** React needs eval in development for better error stacks. */
  dev: boolean;
  /** The site runs on HTTPS: ask the browser to upgrade any http:// subresource. */
  https: boolean;
  /** Extra origins the browser may send requests to (the R2 upload endpoint). */
  connect: string[];
};

export function contentSecurityPolicy({ nonce, dev, https, connect }: CspOptions): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // Only scripts carrying the nonce, and what they load ('strict-dynamic').
    ["script-src", ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])]],
    // UI components set inline style attributes, which nonces cannot cover.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Receipt photos come from R2 (its public domain or a signed link); blob: for the upload preview.
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:"]],
    // Photos are PUT straight to R2 with a pre-signed URL.
    ["connect-src", ["'self'", "https://*.r2.cloudflarestorage.com", ...connect]],
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** The origin of a URL ("https://x.example.com/a" -> "https://x.example.com"), or null. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
