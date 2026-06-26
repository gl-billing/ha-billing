# HA Billing — Hernandez & Associates

Standalone billing and office tasks app for **Hernandez & Associates**. The **spreadsheet stays your database**; staff use a browser app instead of the Sheets sidebar.

## What's included

| Path | Purpose |
|------|---------|
| `web/` | Next.js app — dashboard, billing, clients, SOA/AR, reports, tasks |
| `web/DEPLOY.md` | Deploy checklist — Vercel, OAuth, PWA install, custom domain |
| `desktop/` | Optional Tauri desktop app (`.app` on Mac, `.msi` on Windows) |
| `apps-script/` | Web App API bridge (SOA/AR/PDF/Gmail) |
| `office-tasks/` | Tasks Apps Script (V2 + `WebAppApi.gs`) |

## Branding

Letterhead and UI follow the **Hernandez & Associates** black-and-white logo:

- Logo: `web/public/brand/logo.png`
- Reference PDF: `web/public/brand/letterhead-reference.pdf`
- Theme overrides: `web/src/app/ha-theme.css`
- Firm contact (footer, letterhead): set `NEXT_PUBLIC_FIRM_ADDRESS`, `NEXT_PUBLIC_FIRM_EMAIL`, phones, and website in `.env.local`
- Outbound Gmail address: set `FIRM_SENDER_EMAIL` (server-only; should match the public email)

## Setup

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data setup (when ready)

HA needs **separate** billing and tasks workbooks — not the live G&L spreadsheets.

**Full guide:** [`docs/CLEAN-SHEET-SETUP.md`](docs/CLEAN-SHEET-SETUP.md)

Quick start:

```bash
cd web
# Add CRON_GOOGLE_REFRESH_TOKEN to .env.local first (see docs)
npm run create:clean-workbooks -- --also-save-templates
```

Then paste the printed spreadsheet IDs into `.env.local`, deploy Apps Script onto the new workbooks, and redeploy Vercel.
