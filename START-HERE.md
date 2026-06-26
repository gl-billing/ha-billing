# Start here (HA Billing + Tasks)

**One app, one port** — billing and tasks both run from `web/` (port **3000**).

```bash
cd web
npm run dev:clean
```

Wait until you see **Ready**. Then open:

- **Mac:** http://localhost:3000/login
- **Office hub (billing + tasks):** http://localhost:3000/portal
- **Tasks only:** http://localhost:3000/app
- **Billing only:** http://localhost:3000/billing
- **iPhone (live):** **https://ha-billing.vercel.app/portal** — not `/billing` alone

**Tasks need their own spreadsheet ID** in `web/.env.local`:

```bash
TASKS_GOOGLE_SPREADSHEET_ID=<your-office-tasks-spreadsheet-id>
```

(Without this, tasks try to read the billing file and fail with “Unable to parse range: Master Tasks”.)

Optional: `tasks-web/` on port 3001 is only if you still run the old split setup.

---

## If something breaks

| Problem | Fix |
|---------|-----|
| `EADDRINUSE` port 3000 or 3001 | Run `npm run dev:clean` in that app folder |
| `Internal Server Error` / missing `.js` module | `npm run dev:clean` (clears `.next`) |
| Phone cannot open `localhost` | Use the **IP address** from `dev:clean`, not localhost |
| Google sign-in fails on phone | Use **https://ha-billing.vercel.app** on the phone — not a LAN IP (Google rejects IPs in OAuth) |

---

## iPhone — Add to Home Screen

**Best on production (HTTPS):** deploy with `web/DEPLOY.md`, then on the phone:

1. Open your live URL in **Safari** (not Chrome for the first install).
2. Sign in once in Safari.
3. Tap **Share** (square with arrow at the bottom) → **Add to Home Screen** → **Add**.
4. Open **HA Office** from the home screen icon.

**Do not** Add to Home Screen from `http://192.168.x.x:3000` — that shortcut only reaches your Mac on Wi‑Fi and breaks Google sign-in. Delete any old icon that shows `192.168` under the name.

**LAN IP (`http://192.168.x.x:3000`) on iPhone:** pages may load, but **Google sign-in will not work** — Google OAuth requires a public domain (`.com`, `.app`, etc.), not a home Wi‑Fi IP.

**Mac-only local dev:** keep `http://localhost:3000` in Google OAuth and use that on the Mac.

A banner at the bottom explains install steps. Tap **Not now** to hide it.

**If sign-in fails from the home-screen icon:** open the site once in Safari at the same URL, sign in, then try the icon again.

---

## Mac Dock (web app icon)

See **`web/MAC-DOCK.md`**: Safari **File → Add to Dock**, or Chrome **Install HA Office**, after opening **https://ha-billing.vercel.app**.

---

## Production (staff phones, no Mac needed)

Deploy **one** Vercel project with root directory **`web`** — billing and tasks are both in that app.

Checklist: `web/DEPLOY.md`. Set `TASKS_GOOGLE_SPREADSHEET_ID` if tasks use a different sheet. Leave `NEXT_PUBLIC_TASKS_APP_URL` unset (or `same`).

### Vercel still shows the **old** layout?

Your **local** code is newer than what’s on GitHub/Vercel. Push and redeploy:

```bash
git add web START-HERE.md desktop
git commit -m "Updated HA Office UI (portal, tasks, mobile)"
git push origin main
```

Wait for Vercel **Deployments → Ready**, then refresh the phone (delete old home-screen icon first).

`tasks-web/` is only for the old two-port local setup.
