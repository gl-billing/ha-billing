# HA Billing — deployment checklist

Use this before onboarding staff or deploying to production.

## Authentication (Google OAuth)

- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set in Vercel/host env
- [ ] `NEXTAUTH_SECRET` set (unique per environment)
- [ ] `NEXTAUTH_URL` matches the live site URL (e.g. `https://billing.example.com`)

## Staff access

- [ ] `ALLOWED_EMAILS` lists every staff Google login (comma-separated), **or**
- [ ] `ALLOWED_EMAIL_DOMAIN` restricts to your firm domain
- [ ] **Production:** never leave both unset — `isStaffEmail()` denies all when unset in production

## Spreadsheets

- [ ] `GOOGLE_SPREADSHEET_ID` — main billing workbook
- [ ] `TASKS_GOOGLE_SPREADSHEET_ID` — office tasks workbook (optional; falls back to billing ID)
- [ ] Each staff login is **Editor** on both workbooks in Google Drive (General access: Restricted + share by email)
- [ ] Service account / Apps Script URLs configured if used (`TASKS_APPS_SCRIPT_URL`, etc.)

## Per-person verification

| Person | Google login | Spreadsheet Editor | Expected desk |
|--------|--------------|-------------------|---------------|
| | | | Billing / Tasks / Secretary desk |

## After deploy

- [ ] Sign in as each role — Office Hub → Tasks → Billing
- [ ] Record a test charge (admin) or open My work (associate)
- [ ] `npm test` and `npm run test:e2e` pass in CI

## Common “restricted” symptom

**Spreadsheet access needed** in the app UI almost always means the workbook is not shared with that person’s **exact** Google email as Editor — not an app role block.
