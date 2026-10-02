/**
 * Seeds the database with default settings (and demo data in later modules).
 * Run with: npm run seed
 * Safe to run again: existing records are kept.
 */
import { config } from "dotenv";
import { disconnectDB } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { ensureDefaultSettings, syncModelIndexes } from "@/server/bootstrap";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const env = getServerEnv();
  console.log(`Seeding database "${env.MONGODB_DB}"...`);

  const settings = await ensureDefaultSettings();
  console.log(`- settings: ${settings.programName}, ${settings.villageName}`);

  const models = await syncModelIndexes();
  console.log(`- indexes synced for: ${models.join(", ")}`);

  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
