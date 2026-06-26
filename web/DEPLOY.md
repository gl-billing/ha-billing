# HA Billing — Deploy checklist

Use this checklist to go from localhost to a live app staff can use on **desktop and mobile**.

---

## Phase 1 — GitHub & Vercel

- [ ] Push this repo to GitHub (private repo recommended)
- [ ] Go to [vercel.com/new](https://vercel.com/new) → Import the repo
- [ ] Set **Root Directory** to `web` (not the repo root)
- [ ] Framework: Next.js (auto-detected)
- [ ] Deploy once with env vars empty to confirm build works, then add vars below

### Environment variables (Vercel → Settings → Environment Variables)

Copy from `web/.env.example`. Set for **Production**, **Preview**, and **Development**:

| Variable | Example / notes |
|----------|-----------------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → OAuth client |
| `GOOGLE_CLIENT_SECRET` | Same OAuth client |
| `GOOGLE_SPREADSHEET_ID` | Spreadsheet ID from URL |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://YOUR-PROJECT.vercel.app` (update when custom domain is live) |
| `ALLOWED_EMAIL_DOMAIN` | e.g. `hernandezassociates.com` **or** use `ALLOWED_EMAILS` |
| `ADMIN_EMAILS` | Comma-separated owner emails allowed to **permanently delete** clients |
| `TASKS_ONLY_EMAILS` | Staff who **must not** open billing — tasks & calendar only. Example: `farvjas53@gmail.com,jasbriehappy@hernandezassociates.com`. Must also be in `ALLOWED_EMAILS` or `ALLOWED_EMAIL_DOMAIN`. After changing, redeploy and have them **sign out and sign in again**. |
| `APPS_SCRIPT_WEB_APP_URL` | Apps Script deployment URL |
| `APPS_SCRIPT_WEB_APP_SECRET` | Same as Settings → Web App Secret in spreadsheet |
| `CRON_SECRET` | Random string — Vercel sends this for hourly dashboard cron (`openssl rand -base64 32`) |
| `CRON_GOOGLE_REFRESH_TOKEN` | **Recommended** for automatic birthday greetings (and BIR deadline seed). From [OAuth Playground](https://developers.google.com/oauthplayground) with offline access — firm account, scopes: `spreadsheets`, `gmail.send`, `gmail.compose`. Uses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to refresh. |
| `CRON_GOOGLE_ACCESS_TOKEN` | Optional fallback only (expires ~1 hour). Prefer `CRON_GOOGLE_REFRESH_TOKEN`. |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` (used for PWA + desktop app) |

- [ ] Redeploy after all env vars are set

---

## Phase 2 — Google Cloud OAuth

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your **Web application** OAuth client:

**Authorized JavaScript origins**

```
https://YOUR-PROJECT.vercel.app
https://billing.yourfirm.com
```

(Add custom domain when ready.)

**Authorized redirect URIs**

```
https://YOUR-PROJECT.vercel.app/api/auth/callback/google
https://billing.yourfirm.com/api/auth/callback/google
```

- [ ] Save OAuth client
- [ ] Enable **Google Sheets API** and **Google Drive API** if not already enabled

### Optional: raise Sheets read quota

If staff hit “too many reads” often:

- [ ] Cloud Console → APIs → Google Sheets API → Quotas → request increase for “Read requests per minute per user”

---

## Phase 3 — Apps Script

In your spreadsheet → Extensions → Apps Script:

- [ ] Paste `WebAppHeadless.gs`, `WebAppApi.gs`, `Triggers.gs` (keep existing `code.gs`)
- [ ] Settings sheet: set **Web App Secret** (random string — same as `APPS_SCRIPT_WEB_APP_SECRET`)
- [ ] **Deploy → New deployment → Web app**
  - Execute as: **Me**
  - Who has access: **Anyone** (token auth is in the script)
- [ ] Copy deployment URL → `APPS_SCRIPT_WEB_APP_URL` in Vercel
- [ ] Redeploy Vercel if you changed env vars

In the live web app:

- [ ] **Reports → Enable hourly dashboard sync**
- [ ] **Reports → Refresh dashboard now** (once)
- [ ] Send a test SOA and AR to yourself

---

## Phase 4 — Custom domain (optional but recommended)

In Vercel → Project → Settings → Domains:

- [ ] Add domain e.g. `billing.hernandezassociates.com`
- [ ] Add DNS record at your registrar (Vercel shows CNAME or A record)
- [ ] Wait for SSL (usually &lt; 5 minutes)
- [ ] Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://billing.hernandezassociates.com`
- [ ] Add same domain to Google OAuth origins + redirect URI (Phase 2)
- [ ] Redeploy Vercel

---

## Phase 4b — Push latest UI before staff use mobile

If **ha-billing.vercel.app** looks older than localhost, the repo on GitHub is behind your Mac:

```bash
git add web START-HERE.md desktop
git commit -m "Deploy latest HA Office UI"
git push origin main
```

Vercel auto-deploys from `main` (root directory **`web`**). Confirm **Deployments** shows a new build **Ready**.

Staff on iPhone: delete the old home-screen shortcut → open the Vercel URL in Safari → Add to Home Screen again.

Mac Dock: see `web/MAC-DOCK.md`.

---

## Phase 5 — Install on devices (PWA)

After HTTPS is live:

### iPhone / iPad

1. Open the live URL in **Safari** (recommended for first install)
2. Sign in with Google once in Safari
3. Tap **Share** (bottom bar) → **Add to Home Screen** → **Add**
4. Name it **HA Office** (or keep the default)

If you use Chrome on iPhone, copy the URL and open it in Safari first, or use **Open in Safari** from Chrome’s menu.

### Android

1. Open URL in **Chrome**
2. Tap menu → **Install app** or **Add to Home screen**

### Mac / Windows desktop

1. Open URL in **Chrome** or **Edge**
2. Click **Install** in the address bar (or ⋮ menu → Install HA Billing)

The app shows an install banner on first visit; tap **Install** or dismiss with **Not now**.

---

## Phase 6 — Desktop app (Tauri, optional)

See `desktop/README.md` for a native `.app` / `.exe` that opens your live billing URL.

- [ ] Set production URL in `desktop/src-tauri/tauri.conf.json`
- [ ] Build on Mac: `cd desktop && npm run tauri build`

---

## Phase 7 — Staff rollout

- [ ] Add every staff Gmail to `ALLOWED_EMAILS` or confirm domain in `ALLOWED_EMAIL_DOMAIN`
- [ ] Share the URL + one-page guide (login → Dashboard → Billing → SOA)
- [ ] Schedule weekly **Backup spreadsheet** (Reports tab)
- [ ] Month-end: Dashboard → **Batch SOA** → export aging CSV

---

## Verify production (5-minute test)

- [ ] Sign in with firm Google account
- [ ] Dashboard loads without quota error
- [ ] Add a test charge → balance updates
- [ ] Client list sort/filter works
- [ ] SOA sends email + PDF opens
- [ ] Install banner appears (or manual Add to Home Screen on iOS)
- [ ] Sign out / sign in again

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Sign-in redirect error / iPhone “can’t connect to server” after Google | On **Vercel**, set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://ha-billing.vercel.app` (not `localhost`), then **Redeploy**. On the phone, delete the old home-screen icon and use Safari at the Vercel URL again. |
| Unauthorized on sign-in | Email not in `ALLOWED_EMAILS` / domain |
| SOA/AR fails | Redeploy Apps Script; check `APPS_SCRIPT_WEB_APP_URL` + secret |
| Quota exceeded | Wait 60s; enable hourly sync; request quota increase |
| Unable to parse range: Trust Log!… | Fix formulas: use `='Trust Log'!D1` not `=Trust Log!D1` on client tab E1–E3 / Master List |
| Unable to parse range: 'Audit Log'!… | Add a sheet tab named **Audit Log** (or redeploy latest app — it creates the tab automatically) |
| Writing to column [W] but range ends at V | Redeploy latest app (Master List write must include columns W–Z) |
| Circular dependency on E3 / #REF! | Client tab: E1 = total due, E2 = payments, E3 = charges (see README) |
| Delete button missing | Set `ADMIN_EMAILS` in Vercel to your Google sign-in email; redeploy |
| Install button missing (iOS) | Use Safari → Share → Add to Home Screen (Apple does not support programmatic install) |

---

**Production URL:** `_________________________________`

**Custom domain:** `_________________________________`

**Deployed by / date:** `_________________________________`
