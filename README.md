# Voter List Console (Next.js, JS)

A lightweight Next.js (JavaScript) frontend for your voter processing backend (PDF → Gemini OCR → Neon). It consumes the API described in `API_DEMO.md` and ships with session listing, uploads, filters, CSV export, and shareable URLs.

## Quick start

1. Install deps

```sh
npm install
```

2. Configure your backend URL in `.env.local` (create it if missing):

```
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

If your backend expects a Gemini key on upload, enter it in the UI field (stored locally in the browser).

3. Run the app

```sh
npm run dev
```

Then open http://localhost:3000 (Next.js defaults) in the browser.

## What’s included

- Pages
  - `/` landing with upload CTA
  - `/sessions` list + upload form
  - `/sessions/[id]` detail with page info and voter filters
- Components: `SessionList`, `UploadForm`, `SessionDetail`, `VoterFilters`, `VoterTable`, `CsvExportButton`
- Styling: Tailwind CSS with a warm sand/teal palette
- Data fetching: abortable fetch with one retry for GETs, inline error banners, status polling while processing
- Filtering: debounced inputs stored in the URL query; client-side pagination; CSV export of the current filtered set
- UX niceties: sticky table headers, loading and empty states, optimistic delete for sessions

## API expectations

- `POST /sessions` multipart file → `{ sessionId, pages, status }`
- `GET /sessions` → `{ sessions: [...] }`
- `GET /sessions/:id` → `{ session, pages, voters }`
- `GET /sessions/:id/voters` + filters → `{ voters }`
- `DELETE /sessions/:id` → `{ deleted }`
- Optional: `GET /voters/search` (global search helper in `lib/api.js`)

## Env & configuration

- `NEXT_PUBLIC_API_BASE` is read client-side for all fetches. Default fallback: `http://localhost:3000`.
- Tailwind config lives in `tailwind.config.js`; global styles in `styles/globals.css`.

## Notes

- The app is JavaScript-only (no TypeScript) and uses the Next.js pages router for simplicity.
- Large voter lists are handled with client-side pagination and CSV export for the filtered set.
- Session detail polls while status contains "processing" and stops on completion/failure.
