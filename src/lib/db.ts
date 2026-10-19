import "server-only";
import dns from "node:dns";
import mongoose from "mongoose";
import { needsPublicDns, PUBLIC_DNS_SERVERS } from "@/lib/dns-fallback";
import { getServerEnv } from "@/lib/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

// Reuse one connection across hot reloads in dev and across requests in prod.
const cache: MongooseCache = globalThis.mongooseCache ?? { conn: null, promise: null };
globalThis.mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const env = getServerEnv();
    // Some Windows machines give Node only 127.0.0.1 as DNS, so the Atlas
    // "mongodb+srv" lookup fails (querySrv ECONNREFUSED). Use public DNS then.
    if (needsPublicDns(env.MONGODB_URI, dns.getServers())) {
      dns.setServers([...PUBLIC_DNS_SERVERS]);
      console.warn("[db] Node had no usable DNS server (only 127.0.0.1); using public DNS to find MongoDB Atlas.");
    }
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB,
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      // On Vercel many short-lived function instances may each hold a pool. Keep
      // pools small and let idle sockets close, so Atlas (M0: 500 connections)
      // never runs out. Plenty for a village fund's traffic.
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

export async function disconnectDB(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
