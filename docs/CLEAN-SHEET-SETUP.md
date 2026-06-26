# HA Billing — clean spreadsheet setup

Hernandez & Associates needs **its own** billing and tasks workbooks — separate from the live G&L spreadsheets. Never point HA at the GL live `GOOGLE_SPREADSHEET_ID`.

## Option A — automated (recommended)

### 1. Get a firm Google refresh token

In [OAuth Playground](https://developers.google.com/oauthplayground):

1. Gear icon → use your own OAuth credentials (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `web/.env.local`).
2. Select scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive` (needed to copy template files by ID)
3. Authorize with the **firm Google account** that owns HA Drive files.
4. Exchange authorization code for tokens → copy the **refresh token**.

> **404 "File not found" when running the script?** The default GL template lives in G&L Drive. Your HA Google account cannot see it until you **make your own copy** (see **Option B** below) and set `GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID` / `GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID` to those copy IDs — or skip the script and paste live workbook IDs after manual copy.

### 1b. HA-owned templates (before running the script)

The script cannot read G&L's private template unless your HA account owns a copy:

1. Open the [blank billing template](https://docs.google.com/spreadsheets/d/1MFrcLDnLrmL7jmjcGU934-sd-udAZFzoKIYZ7NvKvf8/edit) (use a Google account that already has access, usually G&L).
2. **File → Make a copy** → name `HA — Billing (template)` → save to **HA firm's** Google Drive (sign in as HA test user when making the copy, or share the copy to that account).
3. Same for [blank tasks template](https://docs.google.com/spreadsheets/d/1EeezyqT0AeimXz21iJyskXgUtibXzZ7qwoboPCC1at0/edit) → `HA — Tasks (template)`.
4. Add to `web/.env.local`:

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

- Copy the **blank GL billing template** (structure only — no client data) into `Hernandez & Associates — Billing`
- Copy the **blank GL tasks template** into `Hernandez & Associates — Tasks`
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

1. Open the blank billing template:  
   https://docs.google.com/spreadsheets/d/1MFrcLDnLrmL7jmjcGU934-sd-udAZFzoKIYZ7NvKvf8/edit
2. **File → Make a copy** → name it `Hernandez & Associates — Billing`
3. Open the blank tasks template:  
   https://docs.google.com/spreadsheets/d/1EeezyqT0AeimXz21iJyskXgUtibXzZ7qwoboPCC1at0/edit
4. **File → Make a copy** → name it `Hernandez & Associates — Tasks`
5. Confirm **Master List** row 2+ is empty and there are **no client-code tabs** (only system tabs like Settings, Walk-In Clients, etc.).
6. Copy each spreadsheet ID from the URL into `.env.local`:

```bash
GOOGLE_SPREADSHEET_ID=<billing id>
TASKS_GOOGLE_SPREADSHEET_ID=<tasks id>
```

---

## Template env vars (optional)

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
| Live GL billing spreadsheet | Contains G&L client data |
| A copy of GL billing with client tabs | Scrub may miss protected ranges |
| Same ID for billing and tasks | Tasks and billing are separate workbooks |
