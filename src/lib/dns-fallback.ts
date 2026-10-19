// A known Node.js problem on some Windows machines: Node fails to read the
// network adapter's DNS servers and silently uses 127.0.0.1, where nothing
// answers. Normal websites still work (Windows resolves them), but the
// "mongodb+srv://" address of Atlas needs a DNS SRV lookup, which then fails
// with "querySrv ECONNREFUSED". In exactly that case the app asks public DNS
// servers instead. Pure, so it can be tested.

/** Public resolvers used only when Node's own list is broken. */
export const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"] as const;

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|\[::1\](:\d+)?)(:\d+)?$/;

/**
 * True when the connection string needs an SRV lookup and Node's DNS list is
 * empty or only points at this computer (127.0.0.1 / ::1).
 */
export function needsPublicDns(uri: string, servers: readonly string[]): boolean {
  if (!uri.startsWith("mongodb+srv://")) return false;
  return servers.length === 0 || servers.every((s) => LOOPBACK.test(s.trim()));
}
