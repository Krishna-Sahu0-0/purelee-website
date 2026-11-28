# PureLee Water Purifiers — Website & Smart Purifier Portal

Official website and IoT customer dashboard for **PureLee Water Purifiers** (Berhampur, Odisha). Built with zero-build static **HTML5, CSS3, and Vanilla JavaScript**, deployed on GitHub Pages with a custom domain and backed by Supabase Realtime cloud telemetry.

- **Live Website:** [https://purelee.in](https://purelee.in)
- **Customer Smart Purifier Portal:** [https://purelee.in/smart-purifier.html](https://purelee.in/smart-purifier.html)

---

## Key Features

### 1. Storefront & Service Landing Page (`index.html`)
- **Product Showcase:** Highlights featured domestic RO+UV+UF+TDS models (`AQUA EDGE 7`, `AQUA NATURAL GRAND`, `AQUA ALFA`), UV purifiers, and Smart RO Water Purifiers.
- **Services Overview:** Dedicated sections for Purifier Service, RO Spare Parts, Commercial RO Plants, and Brand-Based Service.
- **Direct Contact & Navigation:** Sticky header navigation, one-tap phone call CTA (`+91 7008804323`), store address, and entry points to the Smart Purifier portal.
- **Responsive Design:** Clean desktop and mobile layouts powered by shared CSS custom properties in `style.css`.

### 2. Customer Smart Purifier IoT Portal (`smart-purifier.html`)
- **Customer Accounts:** Email/password Sign In and Sign Up powered by Supabase Auth.
- **Secure Device Pairing:** Customers link their purifier using a unique `Device ID` and one-time `Claim Code` via manual entry, QR link query auto-fill (`?device=...&code=...`), or supported browser camera QR scanning (`BarcodeDetector`).
- **Live Online / Offline Status:** Real-time updates via WebSockets with automatic `ONLINE` / `OFFLINE (>15m)` status tracking and IST (`Asia/Kolkata`) last-seen timestamps.
- **Water Consumption Analytics:** Displays lifetime Total (L), Today (IST, resetting at midnight IST), Last 7 Days, Last 30 Days, live flow rate (`L/min`), a 14-day daily usage bar chart, and a recent TDS & flow trend chart (Chart.js).
- **TDS Water Quality Monitoring:** Live TDS reading (`ppm`) with non-locking High TDS (`> 500 ppm`) and probe sensor warnings while purification continues.
- **6-Stage Individual Filter Life Tracking:**
  1. **Pre-Filter** (`3,500 L`) — replacement reminder
  2. **Sediment Filter** (`6,000 L`) — replacement reminder
  3. **Pre-Carbon** (`6,000 L`) — replacement reminder
  4. **Post-Carbon** (`6,500 L`) — replacement reminder
  5. **UF Membrane** (`6,500 L`) — replacement reminder
  6. **UV Filter** (`7,000 L`) — service lock (stops pump until authorized service)
- **Read-Only Service Log:** Displays customer-visible maintenance events; administrative resets and device provisioning are strictly isolated in backend-enforced staff systems.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Markup & Styling** | HTML5, CSS3 (`style.css`, `assets/css/smart-purifier.css`), Google Fonts (`Montserrat`, `Open Sans`) |
| **Client Logic** | Vanilla ES6 JavaScript (`assets/js/purifier-app.js`) |
| **Charts & SDK (CDN)** | Chart.js v4 (`chart.umd.min.js`), `@supabase/supabase-js` v2 |
| **Cloud Integration** | Supabase Auth, PostgreSQL (RLS), Realtime WebSockets, Edge Functions |
| **Hosting** | GitHub Pages (`CNAME`: `purelee.in`) |

---

## Project Structure

```text
purelee-website/
├── CNAME                          # Custom domain configuration (purelee.in)
├── index.html                     # Storefront & services landing page
├── style.css                      # Base design tokens, navbar, footer & storefront styles
├── smart-purifier.html            # Customer Smart Purifier dashboard page
├── assets/
│   ├── css/
│   │   └── smart-purifier.css     # Dashboard cards, alerts, filter bars & responsive grid
│   └── js/
│       ├── supabase-config.js     # Public Supabase project URL & publishable anon key
│       └── purifier-app.js        # Auth, pairing, Realtime telemetry & Chart.js rendering
└── README.md
```

---

## Local Development & Configuration

Because the site has no build step or package manager dependencies, you can preview it directly with any static HTTP server.

### 1. Configure Public Supabase Keys
Edit `assets/js/supabase-config.js` with your Supabase Project URL and public **anon / publishable** key:

```js
window.PURELEE_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
};
```

> **Security Note:** Never place `service_role` keys, secret API keys, or hardware device secrets in any frontend file. All database reads and device pairing calls are enforced server-side via PostgreSQL Row-Level Security (RLS) and authenticated Edge Functions.

### 2. Run Locally
From the repository root, start a static server (avoid opening `smart-purifier.html` via `file://` so ES/CORS and URL query routing work properly):

```bash
# Option A: Python
python -m http.server 8080

# Option B: Node.js
npx serve . -l 8080
```

Open in your browser:
- Storefront: `http://localhost:8080/`
- Smart Purifier Portal: `http://localhost:8080/smart-purifier.html`

---

## Deployment Guide

### Option A: GitHub Pages (Current Live Setup)
1. Push your verified changes to the `main` branch on GitHub (`Krishna-Sahu0-0/purelee-website`).
2. In GitHub **Settings → Pages**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` / `/ (root)`
   - **Custom domain:** `purelee.in` (stored in `CNAME`)
   - Enable **Enforce HTTPS**.
3. Ensure your domain registrar DNS records include:
   - Four `A` records for `@` pointing to GitHub Pages IPs (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)
   - Optional `CNAME` record for `www` pointing to `<your-github-username>.github.io`.
4. Live changes deploy automatically within 1–2 minutes after pushing to `main`:
   - [https://purelee.in](https://purelee.in)
   - [https://purelee.in/smart-purifier.html](https://purelee.in/smart-purifier.html)

### Option B: Hostinger / Shared Static Hosting (`public_html/`)
1. Log in to your hosting panel → **File Manager** → `public_html/`.
2. Upload all public website files **preserving the folder structure**:
   - `index.html`
   - `style.css`
   - `smart-purifier.html`
   - `assets/` (`assets/css/smart-purifier.css`, `assets/js/supabase-config.js`, `assets/js/purifier-app.js`)
3. Enable SSL/HTTPS in your hosting control panel so browser APIs (including camera QR scanning and Supabase Auth) operate over HTTPS.

> For subdirectory hosting (e.g., `yourdomain.com/purelee/`), place all of the files above inside `public_html/purelee/`. All asset paths (`style.css`, `assets/...`, `smart-purifier.html`) are relative and work from subdirectories without modification.

---

## Customization Guide

- **Theme & Colors:** Update CSS variables (`--navy`, `--blue`, `--gold`, `--orange`, `--red`, `--bg-light`) in `:root` at the top of `style.css` and portal accent variables in `assets/css/smart-purifier.css`.
- **Contact Phone & Address:** Update `+91 7008804323` and `Berhampur, Odisha` across `index.html` and `smart-purifier.html`.
- **Product Photos:** Replace the inline `<svg>` placeholders inside `.product-img` blocks in `index.html` with optimized `<img>` assets.
- **CORS Allowlist:** If deploying to a new custom domain, add the new origin to your backend Edge Function CORS allowlist and Supabase **Authentication → URL Configuration** (`Site URL` and `Redirect URLs`).

---

## License

Copyright &copy; 2026 PureLee Water Purifiers. All rights reserved.
