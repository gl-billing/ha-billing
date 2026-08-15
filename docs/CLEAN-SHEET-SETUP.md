# HA Billing — clean spreadsheet setup

Hernandez & Associates needs **its own** billing and tasks workbooks. Point `GOOGLE_SPREADSHEET_ID` and `TASKS_GOOGLE_SPREADSHEET_ID` only at HA-owned files.

## Option A — automated (recommended)

### 1. Get a firm Google refresh token

In [OAuth Playground](https://developers.google.com/oauthplayground):

1. Gear icon → use your own OAuth credentials (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `web/.env.local`).
2. Select scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive` (needed to copy template files by ID)
3. Authorize with the **firm Google account** that owns HA Drive files.
4. Exchange authorization code for tokens → copy the **refresh token**.

### 1b. HA-owned templates (required before running the script)

Use blank billing and tasks templates that already live in **HA Drive** (structure only — empty Master List, no client ledger tabs):

1. Open the HA billing template in Drive → **File → Make a copy** if you need a fresh blank, named `HA — Billing (template)`.
2. Same for the HA tasks template → `HA — Tasks (template)`.
3. Add to `web/.env.local`:

```bash
GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID=<id from HA billing template URL>
GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID=<id from HA tasks template URL>
```

Then continue with step 2 below.

### 1c. Save refresh token

Add to `web/.env.local`:

```bash
CRON_GOOGLE_REFRESH_TOKEN=<paste refresh token>
```

### 2. Run the setup script

```bash
cd web
npx tsx scripts/create-clean-workbooks.ts --also-save-templates
```

This will:

- Copy the **HA blank billing template** into `Hernandez & Associates — Billing`
- Copy the **HA blank tasks template** into `Hernandez & Associates — Tasks`
- Scrub any stray rows or client ledger tabs
- Optionally save `HA — Billing (template)` and `HA — Tasks (template)` for future resets

Paste the printed IDs into `web/.env.local` and Vercel.

### 3. Finish wiring

| Step | Action |
|------|--------|
| Settings | Open billing sheet → **Settings** tab → firm name, email, AR folder ID, NR folder ID |
| Billing Apps Script | `apps-script/` → Extensions → Apps Script on the **new** billing workbook → deploy Web App |
| Tasks Apps Script | `office-tasks/apps-script/` → bind to the **new** tasks workbook |
| Env | Update `APPS_SCRIPT_WEB_APP_URL` / secrets if the Web App URL changed |
| Vercel | Redeploy after env changes |

---

## Option B — manual copy in Google Drive

If you prefer not to run the script:

1. Open the HA blank billing template in Drive.
2. **File → Make a copy** → name it `Hernandez & Associates — Billing`
3. Open the HA blank tasks template in Drive.
4. **File → Make a copy** → name it `Hernandez & Associates — Tasks`
5. Confirm **Master List** row 2+ is empty and there are **no client-code tabs** (only system tabs like Settings, Walk-In Clients, etc.).
6. Copy each spreadsheet ID from the URL into `.env.local`:

```bash
GOOGLE_SPREADSHEET_ID=<billing id>
TASKS_GOOGLE_SPREADSHEET_ID=<tasks id>
```

---

## Template env vars (required for the setup script)

Keep dedicated HA templates for future copies or resets:

```bash
GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID=<HA blank billing template id>
GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID=<HA blank tasks template id>
```

These must **not** be the same IDs as your live workbooks.

---

## What not to use

| Do not use | Why |
|------------|-----|
| Another firm's live billing spreadsheet | Contains another office's client data |
| A copy that still has client tabs | Scrub may miss protected ranges |
| Same ID for billing and tasks | Tasks and billing are separate workbooks |
