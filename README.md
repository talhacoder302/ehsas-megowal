# Ehsas Program, Megowal

A web app for the village welfare fund of Megowal. Members give a fixed monthly contribution; two heads keep the money and use it to help families in need (a daughter's wedding, a death in the family, medical treatment, school fees, house repair, ration). The app replaces the paper registers: every rupee in and out is recorded, every aid case is tracked from request to completion, each month is closed and locked, and members can see their own account and an anonymised monthly report on their phone.

- **Bilingual**: English and Urdu (right-to-left, Nastaliq). Member screens open in Urdu, management screens in English; anyone can switch.
- **Phone first**: built for heads using a phone in the village; installable as an app, with a read-only offline mode.
- **No paid services needed**: MongoDB Atlas free tier, WhatsApp share links instead of a paid API; photo storage (Cloudflare R2) and email (Resend) are optional.

> **Deploying?** See **[DEPLOY.md](DEPLOY.md)** for step-by-step Vercel instructions and the manual checklist.

## Screenshots

<!-- Add screenshots to docs/screenshots/ with these names and they will show here. Capture at 375px wide (phone). -->

| Screen | File to add |
| --- | --- |
| Manage dashboard (budget, collection, cases, approvals, activity) | `docs/screenshots/dashboard.png` |
| Receive payment and the WhatsApp receipt | `docs/screenshots/payment.png` |
| Aid case with timeline and payouts | `docs/screenshots/case.png` |
| Month closing | `docs/screenshots/closing.png` |
| Monthly report with chart | `docs/screenshots/report.png` |
| Member home in Urdu | `docs/screenshots/member-home.png` |
| Opening setup (reconciliation) | `docs/screenshots/setup.png` |

## Features

### For members (`/member`, Urdu by default)
- Home: amount still owed, which months of this year are paid, the latest receipt.
- Full contribution history with every receipt (view and PDF in Urdu or English).
- Monthly reports (members copy: families' names hidden unless the family agreed) with a 12-month chart.
- Aid cases list, anonymised, with status and the latest reason.

### For heads (`/manage`)
- **Dashboard**: money in all accounts, committed to open cases, emergency reserve and free to spend; this month's collection against what is expected; members still owing; open cases by status; cases on hold or not updated for 7+ days; aid payments waiting for a second head; recent activity.
- **Members**: add, edit, change status (left, deceased, exempt) with a reason and date, create logins shared on WhatsApp in Roman Urdu, Excel export and Excel import.
- **Contributions**: rates that can change over time, monthly bills (generating twice never duplicates), payments that clear old dues first, advance payments, sequential receipts with a public link, English/Urdu PDF and WhatsApp message, polite reminders, waive and cancel with a reason.
- **Aid cases**: requested → verifying → approved → in progress → completed (or on hold / rejected), every change with a reason; payouts in instalments within the approved amount, with receipt photos; second-head approval above a limit.
- **Money out**: expenses with photos, transfers between accounts, balances that can never go below zero.
- **Keeping the books**: cash counts with differences explained, month closing (opening, income, aid, expenses, closing, committed, reserve, free balance) that locks the month; only the admin can reopen, with a reason.
- **Reports**: heads and members copies, PDF in both languages, WhatsApp summary for the village group, optional email to members.
- **Opening setup**: move from the paper register: first month, opening balances, members' old dues, Excel imports of members, old contributions and old completed cases, and a reconciliation summary to compare with the register.

### For the admin
- Users and roles, contribution rates, fund rules (emergency reserve, second-head approval, default for showing beneficiary names).
- **Full backup**: Settings → Download full backup gives every collection as one Excel file (one sheet each), so an offline copy of the community's records can be kept.

### Trust and safety
- Roles: admin, head, member. Every server action and API checks the session and role; members can only ever read their own records and the anonymised reports.
- Beneficiary names, guardians, contacts, mohalla and descriptions are removed on the server for members unless the case allows it.
- Nothing financial is ever deleted: cancellations keep the record with the reason and who did it. Every change is in the activity log.
- Security headers with a per-request Content Security Policy, login rate limiting (5 wrong passwords per 15 minutes) and limits on uploads, imports, emails and backups.

## Tech stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4 + shadcn/ui, MongoDB Atlas + Mongoose, Auth.js (mobile number + password), Zod, next-intl, Recharts, @react-pdf/renderer, SheetJS, Cloudflare R2 (optional), Resend (optional), Serwist (installable app), Vitest.

## Run it on your computer

Requirements: Node.js 20.9 or newer, npm, and a MongoDB database (an Atlas free cluster, or MongoDB running locally).

1. Install:

   ```bash
   npm install
   ```

2. Copy the env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `MONGODB_URI` | yes | Atlas connection string (`mongodb+srv://...`) or `mongodb://127.0.0.1:27017`. |
   | `MONGODB_DB` | no | Database name, defaults to `ehsas_megowal`. |
   | `AUTH_SECRET` | yes | At least 32 characters. Generate with `npx auth secret`. |
   | `AUTH_URL` | production | Your public URL (`AUTH_TRUST_HOST` is only needed behind other proxies). |
   | `NEXT_PUBLIC_APP_URL` | no | Public URL used in receipt and report links. Defaults to the Vercel production domain on Vercel, otherwise `http://localhost:3000`. |
   | `R2_*` | no | Cloudflare R2 for receipt photos. Uploads are off if any is missing. |
   | `RESEND_API_KEY`, `EMAIL_FROM` | no | Report emails. Email is off if missing. |
   | `SEED_ADMIN_MOBILE`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | for the seed | The first admin login. |
   | `SEED_DEMO_PASSWORD` | no | One temporary password for the demo users. |

3. Create the database with demo data and start:

   ```bash
   npm run seed
   npm run dev
   ```

   Open http://localhost:3000 and log in with the admin mobile and password from `.env.local`. The demo has 35 members, 2 heads (0300-1110001 and 0300-1110002), 1 member login (0300-1110003), three months of payments, 9 aid cases, expenses, a closed month and the opening setup done. Demo users must change their password at first login.

   On a real installation use `npm run seed -- --no-demo` (settings, the admin, the Rs. 500 rate and a cash account only).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (the service worker is off in development) |
| `npm run build` | Production build, including the service worker |
| `npm start` | Run the production build yourself (listens on `PORT`, default 3000; not needed on Vercel) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run seed` | Collections, indexes, settings, the admin login and demo data. Safe to run again; never changes existing passwords. `-- --no-demo` for production. |

`GET /api/health` returns `{"status":"ok","db":"up"}` when the app can reach the database.

## Receipt photos (Cloudflare R2, optional)

Photos are compressed in the browser (about 150 KB) and uploaded straight to R2, so the app server never handles the file. Set the `R2_*` variables and a CORS rule on the bucket; step by step in [DEPLOY.md](DEPLOY.md#7-receipt-photos-cloudflare-r2-optional). Without R2 everything works, just without photos.

## Backups

- **Settings → Download full backup** (admin): an Excel file with one sheet per collection (password hashes are never included). Download one at least every month, after closing the month, and give the heads a copy.
- The Atlas free tier has no automatic backups, which is why this button exists.

## Project layout

```
src/app/(public)    landing page, public receipt links, shared report links
src/app/(auth)      login, forced password change
src/app/manage      admin and head screens
src/app/member      member portal (mobile first)
src/app/api         route handlers (PDFs, Excel, backup, health, auth)
src/server          business logic and all database queries (each function checks the session)
src/models          Mongoose models
src/lib             pure rules and helpers (money, dates, permissions, validators, reports, imports)
src/components      ui (shadcn), shared, manage, member
src/i18n            next-intl config and messages (en.json, ur.json)
src/sw.ts           service worker (Serwist)
scripts             seed
assets/fonts        Noto Naskh Arabic UI for Urdu PDFs (SIL Open Font License)
```
