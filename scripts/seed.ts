/**
 * Seeds the database. Safe to run again: existing records are kept and
 * existing passwords are never changed.
 *
 *   npm run seed              settings, admin, 2 heads, demo members, rates,
 *                             cash account and three months of bills and payments
 *   npm run seed -- --no-demo settings, admin, the Rs. 500 rate and a cash account (for production)
 *
 * Needs SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD in .env.local.
 * SEED_DEMO_PASSWORD (optional) gives all demo users the same temporary password.
 */
import { config } from "dotenv";
import { z } from "zod";
import { disconnectDB } from "@/lib/db";
import { currentMonth, parseDateKey, shiftMonth } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { formatMobile, mobileSchema, newPasswordSchema } from "@/lib/validators";
import {
  ensureAccount,
  ensureDefaultSettings,
  ensureMembers,
  ensureRates,
  ensureUser,
  seedDemoContributions,
  syncModelIndexes,
  userIdByMobile,
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

/** "2025-06-10" -> midnight of that day in Pakistan time. */
function day(key: string): Date {
  const date = parseDateKey(key);
  if (!date) throw new Error(`Bad seed date ${key}`);
  return date;
}

// Mohalla names are placeholders until the real list of Megowal mohallas is known.
const MASJID = "Mohalla Masjid Wala";
const CHAUDHRIAN = "Mohalla Chaudhrian";
const ARAIN = "Mohalla Arain";
const DARBAR = "Mohalla Darbar Wala";
const KUMHARAN = "Mohalla Kumharan";
const RAJPUTAN = "Mohalla Rajputan";

// 35 demo members. The first three become the demo heads and member login,
// so keep their order. Matching is on name + father name, so re-running adds only new ones.
const demoMembers: SeedMember[] = [
  { name: "Muhammad Aslam", fatherName: "Ghulam Rasool", mobile: "03001110001", mohalla: MASJID, joinDate: day("2023-01-01") },
  { name: "Abdul Ghafoor", fatherName: "Allah Ditta", mobile: "03001110002", mohalla: CHAUDHRIAN, joinDate: day("2023-01-01") },
  { name: "Muhammad Riaz", fatherName: "Noor Muhammad", mobile: "03001110003", mohalla: ARAIN, joinDate: day("2023-03-01") },
  { name: "Ghulam Mustafa", fatherName: "Muhammad Din", mobile: "03214567201", mohalla: DARBAR, joinDate: day("2023-03-01"), openingDue: 1500 },
  { name: "Zafar Iqbal", fatherName: "Muhammad Sharif", mobile: "03337654302", mohalla: KUMHARAN, joinDate: day("2023-06-01") },
  { name: "Shahid Mehmood", fatherName: "Bashir Ahmad", mobile: "03456789103", mohalla: MASJID, joinDate: day("2023-09-01") },
  { name: "Rana Tariq", fatherName: "Rana Muhammad Akram", mobile: "03017788904", mohalla: RAJPUTAN, joinDate: day("2024-01-01"), openingDue: 500 },
  { name: "Muhammad Ashraf", fatherName: "Sardar Khan", mobile: "03124455605", mohalla: CHAUDHRIAN, joinDate: day("2024-04-01") },
  { name: "Abdul Rehman", fatherName: "Fazal Din", mobile: "03069988706", mohalla: ARAIN, joinDate: day("2024-08-01") },
  { name: "Nasir Ali", fatherName: "Liaqat Ali", mobile: "03225566707", mohalla: DARBAR, joinDate: day("2025-02-01") },
  { name: "Tahir Mehmood", fatherName: "Muhammad Akram", mobile: "03007412358", mohalla: MASJID, joinDate: day("2023-01-01") },
  {
    name: "Imran Haider",
    fatherName: "Ghulam Haider",
    mobile: "03018523697",
    mohalla: KUMHARAN,
    joinDate: day("2023-02-01"),
    statusChange: { status: "left", date: day("2025-06-10"), reason: "Moved to Lahore for work." },
  },
  { name: "Khalid Mehmood", fatherName: "Abdul Majeed", mobile: "03029631478", mohalla: CHAUDHRIAN, joinDate: day("2023-02-01") },
  { name: "Muhammad Sarwar", fatherName: "Fateh Muhammad", mobile: "03034567812", mohalla: ARAIN, joinDate: day("2023-04-01"), openingDue: 1000 },
  {
    name: "Haji Muhammad Yousaf",
    fatherName: "Karam Din",
    mobile: "03057894561",
    mohalla: MASJID,
    joinDate: day("2023-01-01"),
    statusChange: { status: "deceased", date: day("2025-11-02"), reason: "Passed away after a long illness." },
  },
  { name: "Asif Ali", fatherName: "Barkat Ali", mobile: "03063216549", mohalla: DARBAR, joinDate: day("2023-05-01") },
  { name: "Muhammad Boota", fatherName: "Allah Bakhsh", mobile: "03076549873", mohalla: KUMHARAN, joinDate: day("2023-07-01") },
  { name: "Waqas Ahmad", fatherName: "Mushtaq Ahmad", mobile: "03081597536", mohalla: RAJPUTAN, joinDate: day("2023-08-01") },
  {
    name: "Allah Rakha",
    fatherName: "Nawab Din",
    mobile: "03104561237",
    mohalla: ARAIN,
    joinDate: day("2023-10-01"),
    statusChange: {
      status: "exempt",
      date: day("2026-01-01"),
      reason: "Cannot work after an injury. Heads agreed to exempt for now.",
    },
  },
  {
    name: "Mian Fazal Karim",
    fatherName: "Mian Abdul Karim",
    mobile: "",
    mohalla: CHAUDHRIAN,
    joinDate: day("2023-11-01"),
    notes: "Has no phone. Son Tahir brings the contribution every month.",
  },
  { name: "Sajid Hussain", fatherName: "Manzoor Hussain", mobile: "03117539514", mohalla: MASJID, joinDate: day("2024-01-01") },
  { name: "Rana Arshad", fatherName: "Rana Muhammad Aslam", mobile: "03128527419", mohalla: RAJPUTAN, joinDate: day("2024-02-01") },
  { name: "Muhammad Nawaz", fatherName: "Sher Muhammad", mobile: "03139517532", mohalla: DARBAR, joinDate: day("2024-03-01"), openingDue: 2000 },
  { name: "Javed Iqbal", fatherName: "Muhammad Iqbal", mobile: "03146541239", mohalla: KUMHARAN, joinDate: day("2024-05-01") },
  { name: "Abdul Sattar", fatherName: "Abdul Ghani", mobile: "03157412369", mohalla: ARAIN, joinDate: day("2024-06-01") },
  { name: "Zulfiqar Ali", fatherName: "Rehmat Ali", mobile: "03201478523", mohalla: CHAUDHRIAN, joinDate: day("2024-07-01") },
  { name: "Mehboob Alam", fatherName: "Siraj Din", mobile: "03212589634", mohalla: MASJID, joinDate: day("2024-09-01") },
  { name: "Shafqat Ali", fatherName: "Inayat Ali", mobile: "03233698521", mohalla: DARBAR, joinDate: day("2024-10-01") },
  { name: "Muhammad Ilyas", fatherName: "Ghulam Qadir", mobile: "03314785296", mohalla: KUMHARAN, joinDate: day("2024-12-01") },
  { name: "Naveed Akhtar", fatherName: "Akhtar Hussain", mobile: "03345896321", mohalla: RAJPUTAN, joinDate: day("2025-01-01") },
  {
    name: "Hafiz Abdul Qayyum",
    fatherName: "Abdul Hameed",
    mobile: "03356987412",
    mohalla: MASJID,
    joinDate: day("2025-03-01"),
    notes: "Imam of the main masjid.",
  },
  { name: "Mubashir Hassan", fatherName: "Hassan Din", mobile: "03367418529", mohalla: ARAIN, joinDate: day("2025-05-01") },
  { name: "Kashif Raza", fatherName: "Raza Muhammad", mobile: "03408529637", mohalla: CHAUDHRIAN, joinDate: day("2025-08-01") },
  { name: "Chaudhry Mumtaz Ahmad", fatherName: "Chaudhry Riaz Ahmad", mobile: "03419637418", mohalla: CHAUDHRIAN, joinDate: day("2026-01-01") },
  { name: "Umar Farooq", fatherName: "Muhammad Ramzan", mobile: "03427418526", mohalla: DARBAR, joinDate: day("2026-04-01") },
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
  console.log(`- settings: ${settings.programName}, ${settings.villageName}, member numbers ${settings.memberNoPrefix}001...`);

  const admin = await ensureUser({
    name: seedEnv.SEED_ADMIN_NAME,
    mobile: seedEnv.SEED_ADMIN_MOBILE,
    role: "admin",
    language: "en",
    password: seedEnv.SEED_ADMIN_PASSWORD,
    mustChangePassword: false,
  });
  printLogin("admin", seedEnv.SEED_ADMIN_MOBILE, admin, false);

  const thisMonth = currentMonth();
  const CASH = { name: "Cash in hand", type: "cash_in_hand" } as const;

  if (!withDemo) {
    // The real rate today; older rates can be added in Settings.
    const ratesAdded = await ensureRates([{ amount: 500, effectiveFrom: thisMonth, note: "Monthly contribution" }]);
    console.log(`- rates: Rs. 500 from ${thisMonth} (${ratesAdded} new)`);
    const account = await ensureAccount({ ...CASH, holderUserId: null });
    console.log(`- account: ${CASH.name} (${account.created ? "new" : "already there"})`);
    return;
  }

  const members = await ensureMembers(demoMembers);
  const added = members.filter((m) => m.created).length;
  const inactive = demoMembers.filter((m) => m.statusChange).length;
  console.log(`- members: ${members.length} demo members (${added} new, ${inactive} left/deceased/exempt)`);

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

  const ratesAdded = await ensureRates([
    { amount: 300, effectiveFrom: "2023-01", note: "Rate from the paper register" },
    { amount: 500, effectiveFrom: thisMonth, note: "Raised in the monthly meeting" },
  ]);
  console.log(`- rates: Rs. 300 from 2023-01, Rs. 500 from ${thisMonth} (${ratesAdded} new)`);

  const [head1, head2] = await Promise.all([userIdByMobile(demoMembers[0].mobile), userIdByMobile(demoMembers[1].mobile)]);
  if (!head1 || !head2) throw new Error("Demo heads are missing.");
  const account = await ensureAccount({ ...CASH, holderUserId: head1 });
  console.log(`- account: ${CASH.name}, kept by ${demoMembers[0].name} (${account.created ? "new" : "already there"})`);

  const months: [string, string, string] = [shiftMonth(thisMonth, -2), shiftMonth(thisMonth, -1), thisMonth];
  const demo = await seedDemoContributions({ months, accountId: account.id, heads: [head1, head2] });
  console.log(
    demo.skipped
      ? "- contributions: payments already exist, demo history skipped"
      : `- contributions: ${demo.bills} bills for ${months.join(", ")}, ${demo.payments} payments (${demo.cancelled} cancelled), ${demo.waived} bill waived`,
  );
}

main()
  .then(() => console.log("Done."))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
