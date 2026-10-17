# Deploying to Vercel

Step-by-step instructions to put Ehsas Program on **Vercel** at a subdomain such as **https://ehsas.talhacoder.com**. Allow about 45 minutes the first time. Menu names on Vercel and Atlas change from time to time; if a label looks different, look for the closest one.

The repository is already set up for Vercel:

- `vercel.json` runs the server functions in **Mumbai (`bom1`)**, the region closest to Pakistan. Put the database close to it (step 1).
- The Urdu font used by receipt and report PDFs is bundled with the PDF functions (`outputFileTracingIncludes` in `next.config.ts`).
- PDF, Excel, backup and import requests may run for up to 60 seconds.
- Database connection pools are kept small, because Vercel runs many short-lived copies of the app.
- If `NEXT_PUBLIC_APP_URL` is not set, links fall back to the project's production domain on Vercel.

---

## 0. What you need

- A **Vercel** account (sign in with GitHub). The free **Hobby** plan works; it is meant for personal, non-commercial projects, which a village welfare fund is. Move to Pro if your use ever becomes commercial or you need more.
- Access to the GitHub repository `talhacoder302/ehsas-megowal`.
- Access to the DNS of `talhacoder.com` (for example Hostinger → Domains → DNS / Nameservers).
- A free **MongoDB Atlas** account.
- Optional: **Cloudflare** (R2) for receipt photos, **Resend** for report emails.

---

## 1. MongoDB Atlas

1. Create a project and a cluster. The free **M0** cluster is enough. Choose **AWS** and region **Mumbai (ap-south-1)** so the database sits next to Vercel's `bom1` functions. If your cluster is elsewhere, either move it or change `regions` in `vercel.json` to the Vercel region closest to the cluster (for example `fra1` for Frankfurt).
2. **Database Access** → Add New Database User → password authentication, a long random password (avoid `@ : /` or URL-encode them), role **Read and write to any database**.
3. **Connect** → Drivers → copy the connection string (this is `MONGODB_URI`):

   ```
   mongodb+srv://ehsas_app:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

4. **Network Access** → Add IP Address → **Allow access from anywhere (`0.0.0.0/0`)**. Vercel functions do not have fixed outgoing IP addresses (fixed IPs are a paid Vercel add-on), so Atlas cannot be limited to Vercel's IPs. The database stays protected by the user name and the long password; keep them secret. This entry also lets you run the seed from your computer (step 6).

   Alternative: Vercel's **MongoDB Atlas integration** (Vercel Marketplace) can create the cluster, the user, the network rule and the `MONGODB_URI` variable for you. If you use it, still check the region and set `MONGODB_DB` yourself.

---

## 2. Secrets to prepare

```bash
npx auth secret            # prints AUTH_SECRET=...
# or
openssl rand -base64 32
```

Keep in a password manager: the Atlas connection string, `AUTH_SECRET`, the admin mobile and password, and the R2 / Resend keys. **Never commit them.** `.env.local` is git-ignored.

---

## 3. Import the project into Vercel

1. https://vercel.com/new → **Import Git Repository** → choose `talhacoder302/ehsas-megowal` (give Vercel's GitHub app access to it if asked).
2. Settings on the import screen:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | **Next.js** (detected) |
   | Root Directory | `./` |
   | Build Command | default (`npm run build`) |
   | Install Command | default (`npm install`) |
   | Output Directory | default |

3. Open **Environment Variables** on the same screen and add the variables from step 4 **before** the first deploy (or add them later and redeploy).
4. After the project exists: **Settings → Build and Deployment → Node.js Version: 22.x** (20.x also works; the app needs 20.9 or newer).

The build also bundles the service worker (Serwist, with `esbuild` from the dev dependencies, which Vercel installs). You will see `(serwist) ... precache entries` in the build log.

---

## 4. Environment variables

Project → **Settings → Environment Variables**. Each variable can be set for **Production**, **Preview** and **Development**.

| Variable | Environments | Value |
| --- | --- | --- |
| `MONGODB_URI` | **Production** | Atlas connection string (step 1) |
| `MONGODB_DB` | **Production** | `ehsas_megowal` |
| `AUTH_SECRET` | Production, Preview | The secret from step 2 (32+ characters) |
| `NEXT_PUBLIC_APP_URL` | **Production** | `https://ehsas.talhacoder.com` (used in receipt, report and WhatsApp links) |
| `AUTH_URL` | **Production** | `https://ehsas.talhacoder.com` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Production | Receipt photos (step 7). Leave out to turn uploads off. |
| `R2_PUBLIC_URL` | Production | Empty (recommended: private photos), or the bucket's public URL |
| `RESEND_API_KEY`, `EMAIL_FROM` | Production | Report emails (step 8). Leave out to turn email off. |

Not needed on Vercel: `AUTH_TRUST_HOST` (the app already trusts the host), `PORT`, `NODE_ENV`, `R2_ENDPOINT` (leave empty), and the `SEED_*` variables (only used on your computer in step 6).

**Preview deployments** (every branch or pull request gets its own address) must **not** use the real database: either leave `MONGODB_URI` unset for Preview (previews then show an error page, which is fine), or point Preview at a separate test database, for example `MONGODB_DB=ehsas_megowal_preview`. Previews are behind Vercel's login by default (Settings → Deployment Protection).

After changing variables, redeploy: **Deployments** → the latest production deployment → **⋯ → Redeploy**.

---

## 5. Custom subdomain and HTTPS

1. Project → **Settings → Domains** → add `ehsas.talhacoder.com`.
2. Vercel shows the DNS record to create, normally a **CNAME** record:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `ehsas` | `cname.vercel-dns.com` (use exactly what Vercel shows) |

   Add it where `talhacoder.com`'s DNS is managed (for a domain registered at Hostinger: hPanel → Domains → `talhacoder.com` → **DNS / Nameservers** → Add record).
3. Wait until Vercel marks the domain **Valid** (usually minutes; DNS can take up to a few hours). Vercel issues the HTTPS certificate automatically. HTTPS is required for logins, the service worker and the Install button.
4. Make sure `NEXT_PUBLIC_APP_URL` and `AUTH_URL` match this address, then redeploy.

**Check it:** open `https://ehsas.talhacoder.com/api/health`. You should see `{"status":"ok","db":"up",...}`.

---

## 6. Create the admin (run the seed once)

The seed only talks to the database, so run it **from your own computer** against the production database (Atlas already allows it because of `0.0.0.0/0`).

1. In the project folder: `git pull` and `npm install`.
2. Run the seed with the production values for this command only. Values set in the terminal take priority over anything in `.env.local`.

   PowerShell (Windows):

   ```powershell
   $env:MONGODB_URI="mongodb+srv://ehsas_app:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority"
   $env:MONGODB_DB="ehsas_megowal"
   $env:AUTH_SECRET="any 32+ character value (required by the env check, not used by the seed)"
   $env:SEED_ADMIN_MOBILE="03001234567"
   $env:SEED_ADMIN_PASSWORD="a strong password, 8+ characters"
   $env:SEED_ADMIN_NAME="Talha"
   npm run seed -- --no-demo
   ```

   macOS / Linux / Git Bash:

   ```bash
   MONGODB_URI="mongodb+srv://..." MONGODB_DB=ehsas_megowal AUTH_SECRET="..." \
   SEED_ADMIN_MOBILE=03001234567 SEED_ADMIN_PASSWORD="..." SEED_ADMIN_NAME="Talha" \
   npm run seed -- --no-demo
   ```

   **Always use `--no-demo` in production.** It creates the collections and indexes, the default settings, the admin login, the Rs. 500 monthly rate from the current month and a "Cash in hand" account. Running it again later is safe: it never changes existing users or passwords.
3. Close the terminal so the production password is not left behind.

### Create the two heads

1. Log in at `https://ehsas.talhacoder.com/login` with the admin mobile and password.
2. **Members** → add each head as a member.
3. **Users** → **Add user** → name, mobile, role **head**, linked to their member record. The temporary password is shown once, with a WhatsApp button. Each head sets their own password at first login.
4. Member logins: open a member → **Create login**.

---

## 7. Receipt photos: Cloudflare R2 (optional)

Without R2 everything works; payouts and expenses are saved without a photo.

1. Cloudflare → **R2** → Create bucket, for example `ehsas-receipts`.
2. R2 → **Manage R2 API tokens** → Create API token with **Object Read & Write** on this bucket. Note the Access Key ID, Secret Access Key and your Account ID.
3. Bucket → Settings → **CORS policy**:

   ```json
   [
     {
       "AllowedOrigins": ["https://ehsas.talhacoder.com"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. **Public URL**: recommended to leave `R2_PUBLIC_URL` **empty**, so photos stay private and the app creates one-hour links. Or make the bucket public (r2.dev subdomain or a custom domain like `receipts.talhacoder.com`) and set `R2_PUBLIC_URL` to it (no trailing slash); anyone with a photo's link can then open it.
5. Add the `R2_*` variables in Vercel (Production) and redeploy.

---

## 8. Report emails: Resend (optional)

1. Resend → **Domains** → add `talhacoder.com` and create the DNS records Resend shows (in the same DNS zone as step 5). Wait until it is verified.
2. Create an API key. In Vercel set `RESEND_API_KEY` and `EMAIL_FROM` (for example `Ehsas Program <reports@talhacoder.com>`), then redeploy.

---

## 9. First steps in the app

1. **Settings → Fund rules** (admin): emergency reserve, second-head approval limit, default for showing names to members.
2. **Settings → Contribution rates**: check the Rs. 500 rate; add older rates if needed.
3. **Accounts**: add the bank account or mobile wallet if there is one, and set who holds each account.
4. **Opening setup** (heads or admin): first month, opening balances, members' opening dues (or Excel import), optional old contributions and old cases, then compare the **reconciliation summary** with the paper register and mark the setup done.
5. Record the month's work. When the month ends: **cash count**, then **close the month** (this locks the opening setup).
6. **Settings → Download full backup** after every month closing; give the heads a copy. (The Atlas free tier has no automatic backups.)

---

## 10. Updating

Every push to `main` deploys to production automatically; other branches get preview deployments. To redeploy by hand: **Deployments → ⋯ → Redeploy**. After changing environment variables, redeploy. Running the seed again after an update is safe.

---

## 11. Troubleshooting

| Problem | What to check |
| --- | --- |
| Build fails | The build log. Node.js version 20.x or 22.x in project settings. |
| Error page; function logs say "Invalid environment variables" | A required variable is missing for this environment (Production vs Preview) or too short (`AUTH_SECRET` needs 32+ characters). |
| `/api/health` says `"db":"down"` | Atlas Network Access has `0.0.0.0/0`; user name and password in `MONGODB_URI`; the cluster is not paused. |
| Pages are slow | The Atlas cluster region should match `regions` in `vercel.json` (Mumbai ↔ `bom1`). |
| Login loops back to the login page | `AUTH_URL` must be exactly `https://ehsas.talhacoder.com` and you must open the site at that address. |
| Receipt/report links show a `vercel.app` address | Set `NEXT_PUBLIC_APP_URL` for Production and redeploy. |
| Receipt PDF fails | Function logs for the PDF route; the fonts in `assets/fonts` must be in the repository. |
| Photo upload fails | R2 CORS `AllowedOrigins` must be exactly your site address; all four `R2_*` variables set. |
| "Install app" never appears | Open the site on HTTPS at the custom domain; on iPhone use Safari (Share → Add to Home Screen). |
| Report emails not sent | Resend domain verified, `RESEND_API_KEY` and `EMAIL_FROM` set, members have an email. |

Logs: Project → **Logs** (runtime) and each deployment's **Build Logs**.

---

## Manual checklist

- [ ] **Atlas**: M0 cluster on AWS **Mumbai (ap-south-1)**, a database user with a long password, the connection string copied.
- [ ] **Atlas Network Access**: `0.0.0.0/0` (Vercel has no fixed IPs on Hobby).
- [ ] **Vercel**: import `talhacoder302/ehsas-megowal`, Next.js preset, Node.js 22.x.
- [ ] **Vercel environment variables (Production)**: `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `AUTH_URL` (plus R2 / Resend if used). Keep previews off the real database.
- [ ] **Domain**: add `ehsas.talhacoder.com` in Vercel and the CNAME record in the `talhacoder.com` DNS; wait for **Valid**; redeploy.
- [ ] Check `https://ehsas.talhacoder.com/api/health` shows `"db":"up"`.
- [ ] **R2** (optional): bucket, API token, CORS rule for your site, decide on the public URL (recommended: leave `R2_PUBLIC_URL` empty).
- [ ] **Resend** (optional): verify `talhacoder.com`, create an API key, set `EMAIL_FROM`.
- [ ] **Seed once** from your computer: `npm run seed -- --no-demo` with the production values.
- [ ] **First login** as admin; create the two heads and send their temporary passwords on WhatsApp.
- [ ] **Settings**: fund rules and rates checked; bank/wallet accounts added.
- [ ] **Opening setup wizard** completed and compared with the paper register.
- [ ] After the first month: cash count, **close the month**, download the **full backup**.
