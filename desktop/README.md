# HA Billing — Desktop app (Tauri)

A small native wrapper that opens your **deployed** HA Billing URL in its own window — like an app on Mac or Windows, without using the browser chrome.

> **Important:** Deploy the web app to Vercel first (`web/DEPLOY.md`). The desktop app loads that live URL; it does not run the server locally.

---

## Prerequisites

- **Rust:** [rustup.rs](https://rustup.rs/)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

---

## One-time setup

```bash
cd desktop
npm install
```

### 1. Set your production URL

Edit `src-tauri/tauri.conf.json` — replace the placeholder in `app.windows[0].url`:

```json
"url": "https://your-project.vercel.app"
```

Or your custom domain:

```json
"url": "https://billing.hernandezassociates.com"
```

### 2. Generate app icons (from your logo)

```bash
npm run icons
```

This creates `src-tauri/icons/` from `web/public/brand/logo.png`.

---

## Run in development

```bash
npm run dev
```

Opens a desktop window pointing at your configured URL.

---

## Build installer

```bash
npm run build
```

Output:

| Platform | Location |
|----------|----------|
| **macOS** | `src-tauri/target/release/bundle/macos/HA Billing.app` |
| **Windows** | `src-tauri/target/release/bundle/msi/` or `nsis/` |

Copy the `.app` or `.msi` to staff machines. They still need internet and firm Google sign-in.

---

## Updating the URL later

If you change domain or Vercel project:

1. Edit `url` in `tauri.conf.json`
2. Run `npm run build` again
3. Redistribute the new installer

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank window | Check URL in `tauri.conf.json` is HTTPS and the site loads in a normal browser |
| Google sign-in blocked | Use the same URL you added to Google OAuth authorized origins |
| Build fails on Mac | Run `rustc --version` and install Xcode CLT |
| Icons missing | Run `npm run icons` before `npm run build` |

---

## Alternative: no install

Staff can skip the desktop app entirely:

- **Phone:** Safari → Add to Home Screen  
- **Desktop:** Chrome → Install HA Billing (PWA)

See `web/DEPLOY.md` Phase 5.
