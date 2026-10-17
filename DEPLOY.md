# Deploying to Hostinger

Step-by-step instructions to put Ehsas Program on Hostinger's Node.js hosting at a subdomain such as **https://ehsas.talhacoder.com**. Menu names in hPanel change from time to time; if a label below looks different, look for the closest one.

Allow about an hour the first time.

---

## 0. What you need

- A Hostinger plan that includes **Node.js web apps** (check in hPanel that "Node.js web app" is offered under Websites → Add Website; at the time of writing it comes with the Business and Cloud plans).
- The GitHub repository (`talhacoder302/ehsas-megowal`) and access to the GitHub account that owns it.
- The domain `talhacoder.com` in Hostinger (or access to its DNS).
- A free **MongoDB Atlas** account.
- Optional: a **Cloudflare** account for receipt photos (R2) and a **Resend** account for report emails.

---

## 1. MongoDB Atlas

1. Create a project and a cluster. The free **M0** cluster is enough for a village fund. Pick a region close to Hostinger's server (for example Europe or Asia).
2. **Database Access** → Add New Database User:
   - Authentication: password. Choose a long random password (no `@`, `:` or `/`, or URL-encode them).
   - Role: **Read and write to any database** (or readWrite on `ehsas_megowal`).
3. **Connect** → Drivers → copy the connection string. It looks like:

   ```
   mongodb+srv://ehsas_app:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   This is `MONGODB_URI`. The database name goes in `MONGODB_DB` (use `ehsas_megowal`).
4. **Network Access** → Add IP Address:
   - Add **your own computer's IP** (needed to run the seed in step 7).
   - Add the **Hostinger server's IP**. Find it in hPanel: Websites → your Node.js site → Dashboard (or Advanced → SSH access / "Website details"), where the server IP is shown. If the app later shows `"db":"down"` at `/api/health`, the outbound IP may differ: check with Hostinger support, or as a last resort allow `0.0.0.0/0` (anywhere). That only works safely with a strong database password, and you should narrow it again when you know the right IP.

---

## 2. Secrets to prepare

Generate the auth secret on your computer (either works):

```bash
npx auth secret            # prints AUTH_SECRET=...
# or
openssl rand -base64 32
```

Keep these somewhere safe (a password manager): the Atlas connection string, `AUTH_SECRET`, the admin mobile and password you will use, and the R2 / Resend keys if you use them. **Never commit them to GitHub.** `.env.local` is already git-ignored.

---

## 3. The subdomain

If `talhacoder.com` is managed in Hostinger:

1. hPanel → **Domains** (or the site's **Domains** section) → **Subdomains** → create `ehsas` (giving `ehsas.talhacoder.com`). You can also choose the subdomain directly when creating the Node.js web app in step 4. Hostinger offers "use an existing domain/subdomain" there.
2. **SSL**: hPanel → Security → **SSL** → install the free SSL certificate for `ehsas.talhacoder.com`, and turn on **Force HTTPS**. HTTPS is required: logins, the service worker and the Install button only work on HTTPS.

If the domain's DNS is elsewhere, add the record Hostinger shows for the subdomain (usually an `A` record to the server IP, or a `CNAME`) at your DNS provider, then install SSL as above.

---

## 4. Create the Node.js web app

1. hPanel → **Websites** → **Add Website** → **Node.js web app** → **Import Git repository**.
2. **Connect with GitHub** and install the Hostinger GitHub App. Give it access to the `ehsas-megowal` repository (private repositories need the owning account to be connected).
3. Choose the repository, branch **`main`**, and the domain `ehsas.talhacoder.com`.
4. Build settings:

   | Setting | Value |
   | --- | --- |
   | Framework / application type | **Next.js** |
   | Node.js version | **22** (20 also works; the app needs 20.9 or newer) |
   | Root directory | `/` (leave empty) |
   | Package manager | **npm** |
   | Build command / build script | `npm run build` (script name `build`) |
   | Output directory | `.next` |
   | Entry file | leave empty (ignored for Next.js) |
   | Start command (if asked) | `npm start` |

   Hostinger gives the app a port in the `PORT` variable; `npm start` (`next start`) uses it automatically. **Do not set `PORT` yourself.**
5. Do not deploy yet: add the environment variables first (step 6). If it deployed already, that is fine; redeploy after step 6.

---

## 5. Receipt photos: Cloudflare R2 (optional)

Without R2 the app works fully; payouts and expenses are saved without a photo.

1. Cloudflare dashboard → **R2** → Create bucket, for example `ehsas-receipts`. Location: automatic.
2. R2 → **Manage R2 API tokens** → Create API token → permission **Object Read & Write**, limited to this bucket. Note the **Access Key ID**, **Secret Access Key** and your **Account ID** (shown on the R2 overview).
3. Bucket → Settings → **CORS policy** → add (use your real site address):

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

4. **Public URL (`R2_PUBLIC_URL`)**: choose one.
   - **Recommended: leave it empty.** Photos stay private, and the app creates a link valid for one hour each time a head opens one.
   - Or make the bucket public (Settings → Public access → the `r2.dev` subdomain, or a custom domain such as `receipts.talhacoder.com`) and put that URL in `R2_PUBLIC_URL` (no trailing slash). Anyone who has a photo's link can then open it.

---

## 6. Environment variables (hPanel)

Site → **Environment variables** (you can also **import .env** to paste them in one go). They are used both for the build and when the app runs, and they stay across deployments.

| Variable | Required | Value |
| --- | --- | --- |
| `MONGODB_URI` | **yes** | The Atlas connection string from step 1 |
| `MONGODB_DB` | **yes** | `ehsas_megowal` |
| `AUTH_SECRET` | **yes** | The secret from step 2 (32+ characters) |
| `AUTH_URL` | **yes** | `https://ehsas.talhacoder.com` |
| `AUTH_TRUST_HOST` | **yes** | `true` |
| `NEXT_PUBLIC_APP_URL` | **yes** | `https://ehsas.talhacoder.com` (used in receipt, report and WhatsApp links; baked in at build time, so **redeploy** after changing it) |
| `R2_ACCOUNT_ID` | photos | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | photos | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | photos | R2 token secret |
| `R2_BUCKET` | photos | `ehsas-receipts` |
| `R2_PUBLIC_URL` | no | Empty (private photos), or the bucket's public URL |
| `R2_ENDPOINT` | no | **Leave empty** (only for local testing) |
| `RESEND_API_KEY` | email | Resend API key (`re_...`) |
| `EMAIL_FROM` | email | For example `Ehsas Program <reports@talhacoder.com>` (domain must be verified in Resend) |

Do **not** set `PORT` or `NODE_ENV`; Hostinger sets them. The `SEED_*` variables are not needed on the server.

Then click **Deploy** (or **Redeploy**). Watch the build log: it installs packages, runs `npm run build` (which also prints `(serwist) ... precache entries`), then starts the app.

**Check it:** open `https://ehsas.talhacoder.com/api/health`. You should see `{"status":"ok","db":"up",...}`. If `db` is `down`, see Atlas network access (step 1.4).

---

## 7. Create the admin (run the seed once)

The seed only talks to the database, so the simplest and safest way is to run it **from your own computer** against the production database. Your computer's IP must be in Atlas Network Access (step 1.4).

1. On your computer, in the project folder (`git pull` first), make sure dependencies are installed: `npm install`.
2. Run the seed with the production values **for this command only** (do not save them in `.env.local` if that file points at your test database). Values set in the terminal like this take priority over anything in `.env.local`.

   PowerShell (Windows):

   ```powershell
   $env:MONGODB_URI="mongodb+srv://ehsas_app:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority"
   $env:MONGODB_DB="ehsas_megowal"
   $env:AUTH_SECRET="any 32+ character value (not used by the seed, but required by the env check)"
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

   **Always use `--no-demo` in production.** It creates the collections and indexes, the default settings, the admin login, the Rs. 500 monthly rate from the current month and a "Cash in hand" account. Nothing else. Running it again later is safe: it never changes existing users or passwords.

   (If your Hostinger plan has SSH, you can instead run the same command on the server in the app folder.)

3. Close the terminal (or clear the variables) so the production password is not left in your shell.

### Create the two heads

1. Log in at `https://ehsas.talhacoder.com/login` with the admin mobile and password.
2. **Members** → add each head as a member (they are members too).
3. **Users** → **Add user** → name, mobile, role **head**, link to their member record. A temporary password is shown once, with a WhatsApp button to send it. Each head must set their own password at first login.
4. Member logins: open a member → **Create login** (sent on WhatsApp in Roman Urdu).

---

## 8. First steps in the app

1. **Settings → Fund rules** (admin): emergency reserve, second-head approval limit, and whether new cases show names to members.
2. **Settings → Contribution rates**: check the rate (Rs. 500 from the current month); add older rates if needed.
3. **Accounts**: add the bank account or mobile wallet if the fund has one (Cash in hand already exists). Set holders.
4. **Opening setup** (heads or admin), from the paper register:
   1. Program start date and the **first month** to keep in the app.
   2. Opening balance of each account at the start of that month.
   3. Each member's join date and **opening due** (what they owed before the first month), or import members from Excel (template provided).
   4. Optional: old contributions and old completed aid cases from Excel.
   5. Compare the **reconciliation summary** with the register, then mark the setup done.
5. Record the month's payments, cases and expenses. When the month ends, do a **cash count** and **close the month**. That locks the opening setup.
6. Download a **full backup** (Settings) after each month closing and give the heads a copy.

---

## 9. Updating the app

Every push to `main` deploys automatically (Hostinger installs, builds and restarts). To redeploy by hand: site → **Deployments** → **Redeploy**. If you change `NEXT_PUBLIC_APP_URL`, redeploy so the new value is built in. Running the seed again after an update is safe (it only adds new indexes and missing defaults).

---

## 10. Troubleshooting

| Problem | What to check |
| --- | --- |
| Build fails | The build log. Node version 20 or 22; all required variables set; the build needs the dev dependencies (Hostinger installs them by default). |
| Site shows an error page, logs say "Invalid environment variables" | A required variable is missing or too short (`AUTH_SECRET` must be 32+ characters, `MONGODB_URI` must start with `mongodb`). |
| `/api/health` says `"db":"down"` | Atlas Network Access (Hostinger's IP), the database user's password, `MONGODB_URI`. |
| Login keeps returning to the login page | `AUTH_URL` must be exactly the site address with `https://`, and `AUTH_TRUST_HOST=true`. |
| Receipt/report links point to localhost | Set `NEXT_PUBLIC_APP_URL` and redeploy. |
| Photo upload fails | R2 CORS `AllowedOrigins` must be exactly `https://ehsas.talhacoder.com`; all four `R2_*` keys set. |
| "Install app" button never appears | The site must be on HTTPS; on iPhone use Safari (Share → Add to Home Screen). |
| Report emails not sent | `RESEND_API_KEY` and `EMAIL_FROM` set, sending domain verified in Resend, members have an email. |

---

## Manual checklist

Things only you can do (the app cannot do them for you):

- [ ] **Atlas**: create the cluster and a database user; copy the connection string.
- [ ] **Atlas Network Access**: add your computer's IP (for the seed) and the Hostinger server IP.
- [ ] **Hostinger**: create the Node.js web app from GitHub (`main`, Node 22, `npm run build`, `.next`).
- [ ] **Subdomain** `ehsas.talhacoder.com` pointed at the app, **SSL installed** and Force HTTPS on.
- [ ] **Hostinger environment variables**: `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=true`, `NEXT_PUBLIC_APP_URL` (plus R2 / Resend if used). Then redeploy.
- [ ] Check `https://ehsas.talhacoder.com/api/health` shows `"db":"up"`.
- [ ] **R2** (optional): bucket, API token, CORS rule for your site, decide on the public URL (recommended: leave `R2_PUBLIC_URL` empty).
- [ ] **Resend** (optional): add and verify `talhacoder.com` (DNS records Resend gives you), create an API key, set `EMAIL_FROM`.
- [ ] **Seed once** from your computer with `npm run seed -- --no-demo` and the production database values.
- [ ] **First login** as admin; create the two heads (Members → Users) and send their temporary passwords on WhatsApp.
- [ ] **Fund rules and rates** checked in Settings; bank/wallet accounts added.
- [ ] **Opening setup wizard** completed and the reconciliation summary compared with the paper register.
- [ ] After the first month: cash count, **close the month**, download the **full backup**.
