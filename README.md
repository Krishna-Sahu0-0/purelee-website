# PureLee Water Purifiers – Website

Recreated from archived screenshot. Pure HTML/CSS/JS — no frameworks, no dependencies (except Google Fonts CDN).

## Project Structure

```
purelee/
├── index.html       ← entire website (single file)
└── README.md
```

## Deploy on GitHub Pages

1. Create a new GitHub repo (e.g. `purelee-website`)
2. Upload `index.html` to the repo root
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch** → `main` / `root`
5. Save — your site will be live at `https://yourusername.github.io/purelee-website`

## Deploy on Hostinger

1. Log in to Hostinger → **File Manager**
2. Navigate to `public_html/`
3. Upload `index.html`
4. Done — it will serve at your domain root

> If you want the site at a subdirectory (e.g. `yourdomain.com/purelee/`), create a folder `purelee/` inside `public_html/` and upload `index.html` there.

## Customisation Tips

- **Phone number**: Search for `7008804323` and replace with your number
- **Address**: Find `Berhampur, Odisha` and update
- **Product images**: Replace the inline SVG blocks inside `.product-img` divs with real `<img>` tags
- **Colors**: All colors are in CSS variables at the top of the `<style>` block
