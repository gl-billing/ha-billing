# Add HA Office to your Mac Dock

The Dock icon should open **https://ha-billing.vercel.app** (the live site), not `localhost` or `192.168.x.x`.

---

## Option A — Safari (fastest, no build)

1. Open **Safari** → **https://ha-billing.vercel.app/login**
2. Sign in once.
3. Menu bar: **File → Add to Dock…** (macOS Sonoma / Sequoia or newer)
4. Name it **HA Office** → **Add**.

The icon appears in the Dock like an app. Drag it if you want a fixed position.

> If you don’t see **Add to Dock**, update macOS or use Option B.

---

## Option B — Chrome

1. Open **Chrome** → **https://ha-billing.vercel.app/login**
2. Sign in.
3. Click the **Install** icon in the address bar (monitor + arrow), or  
   **⋮ → Save and share → Install HA Office…**
4. Check **Open as window** → **Install**.
5. The app opens in its own window. **Right‑click its Dock icon → Options → Keep in Dock**.

---

## Option C — Native `.app` (Tauri, optional)

For a standalone **HA Office.app** you can copy to Applications:

```bash
cd desktop
npm install
npm run icons
npm run build
```

Open: `desktop/src-tauri/target/release/bundle/macos/HA Office.app`  
Drag it to **Applications** and the Dock.

URL is set in `desktop/src-tauri/tauri.conf.json` → `https://ha-billing.vercel.app/portal`.

---

## See the **new** layout on Mac and iPhone

Vercel only updates after you **push code to GitHub**. Your Mac has many local changes that are **not on Vercel yet**.

From the repo root:

```bash
git add web START-HERE.md desktop
git status
git commit -m "Merge tasks portal, mobile PWA, and updated UI"
git push origin main
```

Then in [Vercel](https://vercel.com) → **ha-billing** → **Deployments** → wait until the latest build is **Ready**.

On iPhone after deploy:

1. Delete the old home-screen icon.
2. Safari → **https://ha-billing.vercel.app/login**
3. Pull down to refresh (or Settings → Safari → Advanced → Website Data → remove ha-billing.vercel.app).
4. Share → **Add to Home Screen** again.
