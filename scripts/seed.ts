/**
 * Seeds the database. Safe to run again: existing records are kept and
 * existing passwords are never changed.
 *
 *   npm run seed              settings, admin, 2 heads and demo members
 *   npm run seed -- --no-demo settings and admin only (for production)
 *
 * Needs SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD in .env.local.
 * SEED_DEMO_PASSWORD (optional) gives all demo users the same temporary password.
 */
import { config } from "dotenv";
import { z } from "zod";
import { disconnectDB } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { formatMobile, mobileSchema, newPasswordSchema } from "@/lib/validators";
import {
  ensureDefaultSettings,
  ensureMembers,
  ensureUser,
  syncModelIndexes,
  type SeedMember,
} from "@/server/bootstrap";

config({ path: [".env.local", ".env"], quiet: true });

const seedEnvSchema = z.object({
  SEED_ADMIN_MOBILE: mobileSchema,
  SEED_ADMIN_PASSWORD: newPasswordSchema,
  SEED_ADMIN_NAME: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || "Admin"),
  SEED_DEMO_PASSWORD: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(newPasswordSchema.optional()),
});

const join = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - 5 * 60 * 60 * 1000);

// Demo members. Names are typical for the area; mohallas are placeholders until the real list is known.
const demoMembers: SeedMember[] = [
  { name: "Muhammad Aslam", fatherName: "Ghulam Rasool", mobile: "03001110001", mohalla: "Mohalla Masjid Wala", joinDate: join(2023, 1) },
  { name: "Abdul Ghafoor", fatherName: "Allah Ditta", mobile: "03001110002", mohalla: "Mohalla Chaudhrian", joinDate: join(2023, 1) },
  { name: "Muhammad Riaz", fatherName: "Noor Muhammad", mobile: "03001110003", mohalla: "Mohalla Arain", joinDate: join(2023, 3) },
  { name: "Ghulam Mustafa", fatherName: "Muhammad Din", mobile: "03214567201", mohalla: "Mohalla Darbar Wala", joinDate: join(2023, 3), openingDue: 1500 },
  { name: "Zafar Iqbal", fatherName: "Muhammad Sharif", mobile: "03337654302", mohalla: "Mohalla Kumharan", joinDate: join(2023, 6) },
  { name: "Shahid Mehmood", fatherName: "Bashir Ahmad", mobile: "03456789103", mohalla: "Mohalla Masjid Wala", joinDate: join(2023, 9) },
  { name: "Rana Tariq", fatherName: "Rana Muhammad Akram", mobile: "03017788904", mohalla: "Mohalla Rajputan", joinDate: join(2024, 1), openingDue: 500 },
  { name: "Muhammad Ashraf", fatherName: "Sardar Khan", mobile: "03124455605", mohalla: "Mohalla Chaudhrian", joinDate: join(2024, 4) },
  { name: "Abdul Rehman", fatherName: "Fazal Din", mobile: "03069988706", mohalla: "Mohalla Arain", joinDate: join(2024, 8) },
  { name: "Nasir Ali", fatherName: "Liaqat Ali", mobile: "03225566707", mohalla: "Mohalla Darbar Wala", joinDate: join(2025, 2) },
];

function printLogin(label: string, mobile: string, result: { created: boolean; password: string | null }, temporary: boolean) {
  if (!result.created) {
    console.log(`- ${label}: ${formatMobile(mobile)} (already exists, password unchanged)`);
    return;
  }
  const note = temporary ? " (temporary, must be changed at first login)" : "";
  console.log(`- ${label}: ${formatMobile(mobile)} / ${result.password}${note}`);
}

async function main() {
  const withDemo = !process.argv.includes("--no-demo");
  const env = getServerEnv();

  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Seed settings missing or invalid:\n${issues.join("\n")}\nSee .env.example.`);
  }
  const seedEnv = parsed.data;

  console.log(`Seeding database "${env.MONGODB_DB}"${withDemo ? " with demo data" : ""}...`);

  const models = await syncModelIndexes();
  console.log(`- indexes synced: ${models.join(", ")}`);

  const settings = await ensureDefaultSettings();
  console.log(`- settings: ${settings.programName}, ${settings.villageName}`);

  const admin = await ensureUser({
    name: seedEnv.SEED_ADMIN_NAME,
    mobile: seedEnv.SEED_ADMIN_MOBILE,
    role: "admin",
    language: "en",
    password: seedEnv.SEED_ADMIN_PASSWORD,
    mustChangePassword: false,
  });
  printLogin("admin", seedEnv.SEED_ADMIN_MOBILE, admin, false);

  if (!withDemo) return;

  const members = await ensureMembers(demoMembers);
  const added = members.filter((m) => m.created).length;
  console.log(`- members: ${members.length} demo members (${added} new)`);

  const demoUsers = [
    { label: "head", member: 0, role: "head", language: "en" },
    { label: "head", member: 1, role: "head", language: "en" },
    { label: "member", member: 2, role: "member", language: "ur" },
  ] as const;

  for (const demo of demoUsers) {
    const seed = demoMembers[demo.member];
    const result = await ensureUser({
      name: seed.name,
      mobile: seed.mobile,
      role: demo.role,
      language: demo.language,
      memberId: members[demo.member].id,
      // A fixed demo password is easier for testing; it still has to be changed at first login.
      password: seedEnv.SEED_DEMO_PASSWORD,
      mustChangePassword: true,
    });
    printLogin(`${demo.label} (${members[demo.member].memberNo} ${seed.name})`, seed.mobile, result, true);
  }
}

main()
  .then(() => console.log("Done."))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
