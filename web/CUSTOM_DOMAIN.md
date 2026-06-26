# Custom domain — billing.hernandezassociates.com

Current live URL: **https://ha-billing.vercel.app**  
Target custom URL: **https://billing.hernandezassociates.com**

---

## Part A — Vercel (5 min)

1. [vercel.com](https://vercel.com) → project **ha-billing**
2. **Settings** → **Domains**
3. Enter: `billing.hernandezassociates.com` → **Add**
4. Vercel shows DNS instructions — keep this tab open

**Also add the root domain (optional but recommended):**

5. Add: `hernandezassociates.com` → set to redirect to `billing.hernandezassociates.com`

---

## Part B — DNS at your domain registrar (5–15 min)

Where you bought **hernandezassociates.com** (GoDaddy, Namecheap, Google Domains, Cloudflare, etc.):

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| **CNAME** | `billing` | `cname.vercel-dns.com` | Auto / 3600 |

Vercel may show a different target — **use exactly what Vercel displays**.

Wait until Vercel Domains page shows **Valid Configuration** and SSL certificate is issued (often 5–30 minutes).

---

## Part C — Update Vercel env vars

**Settings** → **Environment Variables** → edit:

| Variable | New value |
|----------|-----------|
| `NEXTAUTH_URL` | `https://billing.hernandezassociates.com` |
| `NEXT_PUBLIC_APP_URL` | `https://billing.hernandezassociates.com` |

**Deployments** → **Redeploy**

---

## Part D — Google OAuth

[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → OAuth client → **Edit**

**Authorized JavaScript origins** — add:

```
https://billing.hernandezassociates.com
```

**Authorized redirect URIs** — add:

```
https://billing.hernandezassociates.com/api/auth/callback/google
```

Keep `https://ha-billing.vercel.app` entries until custom domain is verified, then you may remove them.

**Save**

---

## Part E — Test

1. Open **https://billing.hernandezassociates.com**
2. Sign in with Google
3. Add to Home Screen on phone using the **new** URL

---

## Part F — Desktop app (optional)

Edit `desktop/src-tauri/tauri.conf.json`:

```json
"url": "https://billing.hernandezassociates.com"
```

Rebuild: `cd desktop && npm run build`

---

## If you use a different domain

Replace `hernandezassociates.com` with your actual domain everywhere above.
