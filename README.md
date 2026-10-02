# Ehsas Program, Megowal

Village welfare fund manager for Ehsas Program, Megowal: member contributions, pending dues, aid case tracking (weddings, funerals, medical), cash accounts and transparent monthly reports. Built with Next.js, TypeScript and MongoDB.

The app is bilingual (English and Urdu). Member screens open in Urdu by default and the management screens open in English; anyone can switch with the language button.

## Requirements

- Node.js 20.9 or newer (developed on Node 24)
- npm
- A MongoDB Atlas cluster (the free tier is enough)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `MONGODB_URI` | yes | Atlas connection string (`mongodb+srv://...`). Add your IP in Atlas > Network Access. |
   | `MONGODB_DB` | no | Database name, defaults to `ehsas_megowal`. |
   | `AUTH_SECRET` | yes | At least 32 characters. Generate with `npx auth secret`. |
   | `AUTH_URL`, `AUTH_TRUST_HOST` | production | Set `AUTH_TRUST_HOST=true` when running behind Hostinger's proxy. |
   | `NEXT_PUBLIC_APP_URL` | no | Public URL of the app, defaults to `http://localhost:3000`. |
   | `R2_*` | no | Cloudflare R2 for receipt photos. Uploads are turned off if any is missing. |
   | `RESEND_API_KEY`, `EMAIL_FROM` | no | Email through Resend. Email is turned off if missing. |

3. Create the database and default settings:

   ```bash
   npm run seed
   ```

4. Start the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run seed` | Create collections, indexes, default settings and demo data. Safe to run again. |

## Checking it works

- `/` landing page with a login button
- `/login` login form (sign-in is switched on in the next module)
- `/manage` management area with sidebar (menu button on phones)
- `/member` member area with bottom navigation, Urdu by default
- `/api/health` returns `{"status":"ok","db":"up"}` when the database is reachable

## Deploying to Hostinger (Node.js hosting)

1. Push the repo and connect it in hPanel, or upload the project.
2. Set the same environment variables as in `.env.local` (with `AUTH_TRUST_HOST=true` and your real `AUTH_URL`).
3. Build command `npm run build`, start command `npm start`.
4. Allow Hostinger's outbound IP in Atlas Network Access.

## Project layout

```
src/app/(public)    landing page
src/app/(auth)      login
src/app/manage      admin and head screens
src/app/member      member portal (mobile first)
src/app/api         route handlers
src/server          business logic and all database queries
src/models          Mongoose models
src/lib             env, db, permissions, money and date helpers
src/components      ui (shadcn), shared, manage, member
src/i18n            next-intl config and messages (en.json, ur.json)
scripts             seed and utility scripts
```
