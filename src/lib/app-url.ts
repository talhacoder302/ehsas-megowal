/**
 * The public address of the app, used in receipt, report and WhatsApp links.
 * NEXT_PUBLIC_APP_URL when set; on Vercel otherwise the project's production
 * domain (or this deployment's own address); locally http://localhost:3000.
 * No trailing slash. Pure, safe in the proxy.
 */
export function resolveAppUrl(env: Record<string, string | undefined>): string {
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
