# Vaada & Associates – Billing PWA · v1.0
Built by Weave Solutions · 26-Oct-2026

## Deploy (GitHub Pages)
1. Create a repo (e.g. `vaada-billing`) and upload all files in this folder (keep the folder structure).
2. Repo → Settings → Pages → Source: `main` branch, `/ (root)` → Save.
3. Open `https://<username>.github.io/vaada-billing/` on the phone → Chrome menu → **Install app** (or Settings tab → "Install app on this phone").
4. **First run:** open ⚙ Settings and fill PAN, GSTIN, email/phone and bank details (they are blank and hidden on the invoice until filled). Default service fees are placeholders – edit them in Services.

## Files
- `index.html` – shell, header, bottom nav
- `styles.css` – app UI + A4 invoice/print styles
- `app.js` – all logic (bill, invoices, customers, services, settings, backup)
- `sw.js` – offline cache (bump `CACHE` name on every release)
- `manifest.json`, `icons/` – PWA install
- `assets/logo.png` (VA mark), `assets/logo-full.png` (full logo, unused spare)
- `assets/weave-logo.png` – **add your Weave Solutions logo here** (PNG, ~26px tall display). Until added, a styled "✦ Weave Solutions" badge shows instead. Links to weavesolution.com, darkens on hover. Shown on Bill page bottom and Settings.

## How it works
- Data is saved in the phone's browser storage (localStorage key `vaada_billing_v1`). No server, works offline.
- Invoice no. format: `PREFIX/FY/seq` (e.g. `VA/2026-27/1`), resets every 1 April.
- Customer is auto-saved/updated on Save & Print. Typing an existing name auto-fills details.
- Previous balance = opening balance + past invoices − payments received. Snapshot is stored in each invoice.
- GST: No GST / CGST+SGST / IGST per bill. If "Apply GST by default" is on, IGST is auto-picked when customer GSTIN state code ≠ firm's (default 22, Chhattisgarh).
- Each invoice stores a copy of firm details, so changing Settings later does not alter old invoices.
- Print uses the phone's print dialog → "Save as PDF" or a printer.

## Known limitations / bugs
- Data lives on one device only; clearing browser data or uninstalling deletes it → use Settings → Download backup regularly.
- iPhone: printing from the installed (home-screen) app can be unreliable on some iOS versions; open in Safari if Print doesn't appear.
- Deleting the latest invoice reuses its number for the next bill.
- Invoices can't be edited after saving (delete & re-create).
- Previous balance on old invoices is a snapshot; deleting an earlier invoice doesn't re-compute later ones.
- Two customers with the exact same name: typing auto-fills the first one; use "Choose saved" to pick the right one.
