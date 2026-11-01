# Farm Records / फार्म रेकर्ड

A simple, free record-keeping app for a small livestock farm: pigs, goats, pheasants, chickens and anything else you add.

- **Staff at the farm** use a laptop or phone with big buttons and bilingual **English / Nepali** labels. It **works with no internet** and uploads by itself when a connection comes back.
- **The owner in the UK** opens a **Google Sheet** that is always up to date: a summary tab, a live list of every animal and batch, and the full history.
- **Costs nothing to run.** The app is hosted on GitHub Pages and the data lives in Google Sheets + Google Drive (photos).

👉 **To install it, follow [SETUP.md](SETUP.md).**

## What staff can record

| Button | Records |
|---|---|
| 🚚 New arrival | Date, animal type, tag / batch number, breed, sex, how many, where from, price (NPR), photo |
| 🐣 Birth | Date, tag or litter number, mother's tag, how many born, breed, sex |
| 💉 Treatment / vaccine | Which animal or batch, treatment type, medicine name |
| ⚖️ Weight | Which animal or batch, weight in kg (average for a batch) |
| 🕊️ Death / loss | Which animal or batch, how many, cause, photo |
| 💰 Sale | Which animal or batch, how many, buyer, sale price (NPR) |

Every entry also stores who recorded it, on which device and when.

**Individual vs batch.** Each animal type is either *Individual*, where every animal has its own tag (pigs, goats), or *Batch*, where a group is counted together under one batch number (chickens, pheasants). This is set per animal type in the Sheet's **Settings** tab. A litter can also be recorded under one number with a count.

## The Google Sheet

| Tab | What it is |
|---|---|
| **Summary** | Live numbers per animal type, the last 30 days (arrivals, births, deaths, sales, treatments), the latest 25 entries and when the farm last uploaded |
| **Animals** | One row per animal or batch, with current count, status (alive / dead / sold), last weight, last treatment… *Rebuilt automatically, so don't edit it.* |
| **Events** | Every entry ever made. This is the master record. Fix mistakes here. |
| **Settings** | The dropdown lists: animal types, staff names, treatment types, causes of death |

## How it works

```
 Farm laptop / phone (Chrome)               Google (free)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ App from GitHub Pages        │  sync  │ Apps Script web app          │
│ • saves entries on the device├───────►│ • checks the farm key        │
│ • uploads when online        │◄───────┤ • adds rows to "Events"      │
│ • downloads lists & records  │        │ • rebuilds Animals / Summary │
└──────────────────────────────┘        │ • saves photos to Drive      │
                                        └──────────────┬───────────────┘
                                                       │
                                            Owner opens the Sheet (UK)
```

- Entries are saved on the device first (IndexedDB), then sent in small batches. Each entry has a unique ID, so a retry over a bad connection never creates duplicates.
- The app always loads the latest version from GitHub when online, and its saved copy when offline. Updates need no action at the farm.
- Photos are shrunk to about 1280px before upload to save mobile data.

## Files

| Path | What |
|---|---|
| `index.html`, `css/`, `js/` | The app (plain HTML/JS, no build step) |
| `js/i18n.js` | All on-screen wording in English and Nepali |
| `js/register.js` | Works out current animals/batches from the events (mirrored in `Code.gs`) |
| `sw.js` | Lets the app open without internet |
| `apps-script/Code.gs` | The Google Sheet script. Paste this into Apps Script. |
| `test/` | Automated browser test with a fake Google Sheet (developers only) |

## For developers

```bash
node test/server.js        # app on http://localhost:8080, fake Google script on :8081
node test/e2e.js           # full browser test (needs Playwright + Chromium)
```

The test runs the real `apps-script/Code.gs` against a small imitation of Google Sheets. It walks through arrivals, births, litters, treatments, weights, deaths with photos, sales, going offline and reconnecting, then checks the resulting Sheet.

## To check

- **Nepali wording** was written without a native speaker's review. Ask a Nepali speaker to read through `js/i18n.js` and the Nepali column of the Settings tab. In particular, check "कालिज (फिजेन्ट)" for pheasant.
- **Fields** are a first draft, to be confirmed with the farm.
